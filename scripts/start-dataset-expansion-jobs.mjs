import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { adminExecutionStatusUrl, defaultOrigin, executionIdFromResponse, postAdminJson } from "./admin-remote-agent.mjs";
import { selectCanonicalDatasets } from "./canonical-dataset-catalog.mjs";

const sessionPath = process.env.RESEARCH_SESSION_PATH ?? join(homedir(), ".research", "session.json");

const dryRun = process.argv.includes("--dry-run") || process.env.CANONICAL_DATASET_EXPAND_DRY_RUN === "1";

const canonicalDatasets = selectCanonicalDatasets();

const resources = {
  profile: "canonical-public",
  backend: "modal",
  resourceProfile: "canonical-public",
  cpu: 4,
  memoryGb: 8,
  workspaceDiskGb: 50,
  storageMode: "modal-volume",
  datasetAccess: "write-version",
  publishMode: "versioned",
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function formatError(error) {
  if (!(error instanceof Error)) return { message: String(error) };
  const payload = { message: error.message };
  const cause = error.cause;
  if (cause && typeof cause === "object") {
    const code = typeof cause.code === "string" ? cause.code : undefined;
    const errno = typeof cause.errno === "number" ? cause.errno : undefined;
    const syscall = typeof cause.syscall === "string" ? cause.syscall : undefined;
    const hostname = typeof cause.hostname === "string" ? cause.hostname : undefined;
    return { ...payload, cause: { code, errno, syscall, hostname } };
  }
  return payload;
}

function readSession() {
  assert(existsSync(sessionPath), `Missing RESEARCH session at ${sessionPath}`);
  const session = JSON.parse(readFileSync(sessionPath, "utf8"));
  assert(typeof session.origin === "string" && session.origin.startsWith("http"), "Invalid RESEARCH session origin.");
  assert(typeof session.accessToken === "string" && session.accessToken.length > 0, "Missing RESEARCH access token.");
  return session;
}

async function api(session, path, options = {}) {
  const response = await fetch(`${session.origin}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const bodyText = await response.text().catch(() => "");
  const body = bodyText ? JSON.parse(bodyText) : {};
  if (!response.ok) {
    const error = new Error(`Remote request failed (${response.status}) for ${path}: ${bodyText || "{}"}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

const results = [];

const artifactSpec = [
  { type: "file", title: "work.md", path: "work.md" },
  { type: "file", title: "report.html", path: "report.html" },
  { type: "file", title: "dataset_briefing.md", path: "dataset_briefing.md" },
  { type: "file", title: "slack_download_alerts.jsonl", path: "slack_download_alerts.jsonl" },
  { type: "file", title: "slack_briefing.md", path: "slack_briefing.md" },
  { type: "structured_result", title: "improvement_result.json", path: "improvement_result.json" },
];

function promptPathForDataset(datasetId) {
  return new URL(`../prompts/dataset-expansion/${datasetId}.md`, import.meta.url);
}

function renderDatasetExpansionPrompt(dataset) {
  const promptUrl = promptPathForDataset(dataset.id);
  assert(existsSync(promptUrl), `Missing dataset expansion prompt for ${dataset.id}: prompts/dataset-expansion/${dataset.id}.md`);
  return readFileSync(promptUrl, "utf8");
}

function classifyCanonicalWrite(dataset) {
  const datasetStatus = dataset.status ?? "unknown";
  const deploymentStatus = dataset.deploymentStatus ?? "unknown";
  const activeRemoteExecutionId = dataset.activeRemoteExecutionId ?? dataset.activeCanonicalExecutionId ?? null;
  const legacyActiveRunId = dataset.activeRunId ?? null;
  const writerLocked = Boolean(activeRemoteExecutionId || legacyActiveRunId);
  const volumeAvailable = dataset.volume !== null
    && (dataset.volume !== undefined || typeof dataset.manifestPath === "string" || datasetStatus !== "missing");
  const legacyLifecycleNeedsReconciliation = datasetStatus !== "ready" || deploymentStatus !== "ready";
  return {
    datasetStatus,
    deploymentStatus,
    storageKind: "modal_volume",
    volumeAvailable,
    writerLocked,
    writeReady: volumeAvailable && !writerLocked,
    improvable: volumeAvailable && !writerLocked,
    activeRemoteExecutionId,
    legacyActiveRunId,
    legacyLifecycleNeedsReconciliation,
    missingOrStale: [
      ...(volumeAvailable ? [] : ["modal_volume"]),
      ...(writerLocked ? ["writer_lock"] : []),
      ...(legacyLifecycleNeedsReconciliation ? ["legacy_status_reconciliation"] : []),
    ],
  };
}

if (dryRun) {
  for (const dataset of canonicalDatasets) {
    const prompt = renderDatasetExpansionPrompt(dataset);
    results.push({
      datasetId: dataset.id,
      status: "dry_run_ready",
      endpoint: "/api/admin/remote-agent-executions",
      kind: "dataset-improvement",
      operation: "dataset-expansion",
      promptLength: prompt.length,
      resources,
      artifacts: artifactSpec.map((artifact) => artifact.path),
    });
  }
  console.log(JSON.stringify({ dryRun, results }, null, 2));
  process.exit();
}

let datasetsPayload;
let session;
try {
  session = readSession();
  datasetsPayload = await api(session, "/api/cli/datasets");
} catch (error) {
  results.push({
    status: "blocked_remote_unreachable",
    error: formatError(error),
    origin: session?.origin ?? null,
  });
  console.log(JSON.stringify({ dryRun, results }, null, 2));
  process.exitCode = 2;
  process.exit();
}

const liveDatasets = new Map((datasetsPayload.datasets ?? []).map((dataset) => [dataset.id, dataset]));

for (const dataset of canonicalDatasets) {
  const liveDataset = liveDatasets.get(dataset.id);
  if (!liveDataset) {
    results.push({ datasetId: dataset.id, status: "skipped_missing_dataset" });
    continue;
  }

  const write = classifyCanonicalWrite(liveDataset);
  if (!write.improvable) {
    results.push({
      datasetId: dataset.id,
      status: write.writerLocked ? "skipped_write_locked" : "skipped_volume_unavailable",
      ...write,
    });
    continue;
  }

  const prompt = renderDatasetExpansionPrompt(dataset);
  const body = {
    prompt,
    type: "analysis",
    config: {
      canonicalDatasetExpand: true,
      jobKind: "dataset-improvement",
      operation: "dataset-expansion",
      datasetId: dataset.id,
      datasetName: dataset.name,
      requiresCodexLogin: true,
      requiredEnvironment: [
        "CANONICAL_DATASET_SLACK_WEBHOOK_URL",
      ],
      resources,
    },
    artifacts: artifactSpec,
  };

  if (dryRun) {
    results.push({ datasetId: dataset.id, status: "dry_run_ready", endpoint: "/api/admin/remote-agent-executions", kind: "dataset-improvement", operation: "dataset-expansion", promptLength: prompt.length, resources, artifacts: artifactSpec.map((artifact) => artifact.path) });
    continue;
  }

  try {
    const { body: started } = await postAdminJson("/api/admin/remote-agent-executions", {
      prompt,
      kind: "dataset-improvement",
      datasetId: dataset.id,
      resources,
      artifactSpec: body.artifacts,
      metadata: body.config,
    });
    const executionId = executionIdFromResponse(started);
    results.push({
      datasetId: dataset.id,
      status: "started",
      writeReadiness: write,
      executionId,
      adminStatusUrl: started.adminStatusUrl ?? adminExecutionStatusUrl(executionId, defaultOrigin),
    });
  } catch (error) {
    results.push({
      datasetId: dataset.id,
      status: "failed_to_start",
      error: formatError(error),
    });
  }
}

console.log(JSON.stringify({ dryRun, results }, null, 2));
const failed = results.filter((r) => ["failed_to_start", "blocked_remote_unreachable"].includes(r.status));
if (failed.length > 0) {
  process.exitCode = 1;
}
