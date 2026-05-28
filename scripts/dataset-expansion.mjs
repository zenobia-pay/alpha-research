import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  adminExecutionArtifactsUrl,
  adminExecutionStatusUrl,
  defaultOrigin,
  executionIdFromResponse,
  postAdminJson,
  readAdminToken,
} from "./admin-remote-agent.mjs";

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

const artifactSpec = [
  { type: "file", title: "work.md", path: "work.md" },
  { type: "file", title: "report.html", path: "report.html" },
  { type: "file", title: "dataset_briefing.md", path: "dataset_briefing.md" },
  { type: "file", title: "slack_download_alerts.jsonl", path: "slack_download_alerts.jsonl" },
  { type: "file", title: "slack_briefing.md", path: "slack_briefing.md" },
  { type: "structured_result", title: "improvement_result.json", path: "improvement_result.json" },
];

const endpoint = "/api/admin/remote-agent-executions";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function argValue(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return null;
  const value = argv[index + 1];
  assert(value && !value.startsWith("--"), `Missing value for ${name}`);
  return value;
}

function readSession() {
  const sessionPath = process.env.RESEARCH_SESSION_PATH ?? join(homedir(), ".research", "session.json");
  const session = JSON.parse(readFileSync(sessionPath, "utf8"));
  assert(typeof session.origin === "string" && session.origin.startsWith("http"), `Invalid session origin in ${sessionPath}.`);
  assert(typeof session.accessToken === "string" && session.accessToken.length > 0, `Missing access token in ${sessionPath}.`);
  return session;
}

async function cliApi(session, path, options = {}) {
  const response = await fetch(`${session.origin}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(`Remote request failed (${response.status}) for ${path}: ${text || "{}"}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

async function adminGet(path, origin = defaultOrigin) {
  const token = readAdminToken();
  assert(token, "Missing ALPHA_RESEARCH_ADMIN_TOKEN.");
  const response = await fetch(new URL(path, origin), {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(`Admin request failed (${response.status}) for ${path}: ${text || "{}"}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

export function renderPrompt({ datasetId, datasetName }) {
  const promptUrl = new URL(`../prompts/dataset-expansion/${datasetId}.md`, import.meta.url);
  assert(existsSync(promptUrl), `Missing dataset expansion prompt for ${datasetId}: prompts/dataset-expansion/${datasetId}.md`);
  const template = readFileSync(promptUrl, "utf8");
  return template.replaceAll("{datasetId}", datasetId).replaceAll("{datasetName}", datasetName);
}

export function promptRecordPath(datasetId, timestamp = new Date().toISOString()) {
  return `docs/canonical-runs/${datasetId}/${timestamp.replaceAll(/[:.]/g, "-")}/dataset-expansion-prompt.md`;
}

function persistPrompt(datasetId, prompt, timestamp) {
  const path = promptRecordPath(datasetId, timestamp);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, prompt.endsWith("\n") ? prompt : `${prompt}\n`, "utf8");
  return path;
}

function artifactCandidates(artifact) {
  const content = artifact?.content && typeof artifact.content === "object" ? artifact.content : {};
  return [artifact?.title, artifact?.path, content.path].filter((value) => typeof value === "string" && value.length > 0);
}

export function hasArtifact(artifacts, requiredPath) {
  return artifacts.some((artifact) => artifactCandidates(artifact).some((candidate) => candidate === requiredPath || candidate.endsWith(`/${requiredPath}`)));
}

function artifactPayload(artifacts, requiredPath) {
  const artifact = artifacts.find((candidate) => artifactCandidates(candidate).some((name) => name === requiredPath || name.endsWith(`/${requiredPath}`)));
  const content = artifact?.content;
  if (content && typeof content === "object" && typeof content.text !== "string") return content;
  if (typeof content === "string") return content;
  if (content && typeof content === "object" && typeof content.text === "string") return content.text;
  return null;
}

function parseResultPayload(payload) {
  if (typeof payload === "string" && payload.trim()) {
    try {
      return JSON.parse(payload);
    } catch {
      return { status: "invalid_json" };
    }
  }
  if (payload && typeof payload === "object") return payload;
  return {};
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.filter((entry) => typeof entry === "string" && entry.trim()).map((entry) => entry.trim());
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

export function summarizeDatasetExpansion({ artifacts, executionId, validation }) {
  const result = parseResultPayload(artifactPayload(artifacts, "improvement_result.json"));
  const expansion = result.expansionSummary && typeof result.expansionSummary === "object" ? result.expansionSummary : {};
  const pathsAdded = normalizeList(expansion.pathAdded ?? expansion.pathsAdded ?? expansion.rawPath);
  const briefingChanges = normalizeList(result.briefingChanges);
  const statusValue = [result.status, validation?.status].filter(Boolean).join(" / ") || "unknown";
  const summaryTable = [
    ["run id", result.runId ?? executionId],
    ["status", statusValue],
    ["actual new dataset added", expansion.actualNewDatasetAdded ?? expansion.datasetAdded ?? null],
    ["path added", pathsAdded.join(", ") || null],
    ["source", expansion.source ?? null],
    ["coverage", expansion.coverage ?? null],
    ["geography", expansion.geography ?? null],
    ["records", expansion.records ?? null],
    ["fields", expansion.fields ?? null],
    ["caveat", expansion.caveat ?? null],
  ].map(([item, value]) => ({ item, value: value ?? "unknown" }));
  return {
    summaryTable,
    briefingChanges,
  };
}

function validateExpansionResult(resultPayload) {
  const blockers = [];
  const expansion = resultPayload?.expansionSummary;
  if (!expansion || typeof expansion !== "object") {
    blockers.push("missing expansionSummary");
  } else {
    for (const field of ["actualNewDatasetAdded", "pathAdded", "source", "coverage", "geography", "records", "fields", "caveat"]) {
      if (typeof expansion[field] !== "string" || !expansion[field].trim()) blockers.push(`missing expansionSummary.${field}`);
    }
  }
  if (!Array.isArray(resultPayload?.briefingChanges) || resultPayload.briefingChanges.length === 0) {
    blockers.push("missing briefingChanges");
  }
  if (!Array.isArray(resultPayload?.slackLifecycleMessages) || resultPayload.slackLifecycleMessages.length < 2) {
    blockers.push("missing slackLifecycleMessages start and finish records");
  }
  return blockers;
}

export function classifyDatasetExpansion({ execution, artifacts, dataset, executionId }) {
  const status = execution?.status ?? "unknown";
  const missingArtifacts = artifactSpec.map((artifact) => artifact.path).filter((path) => !hasArtifact(artifacts, path));
  const resultPayload = parseResultPayload(artifactPayload(artifacts, "improvement_result.json"));
  let resultStatus = null;
  let resultBlocker = null;
  if (resultPayload && typeof resultPayload === "object") {
    resultStatus = resultPayload.status ?? null;
    resultBlocker = resultPayload.blocker ?? null;
  }
  const profile = dataset?.profile ?? null;
  const quality = profile?.profile?.quality ?? profile?.quality ?? {};
  const profileRunId = profile?.volumeInventoryRunId ?? quality?.volumeInventoryRunId ?? profile?.describedRunId ?? null;
  const profileSynced = profileRunId === executionId;
  const resultCompleted = resultStatus === "completed"
    || (resultStatus === "blocked" && resultBlocker === "dataset_profile_update_unavailable" && profileSynced);
  const blockers = [];
  if (!["ready", "completed"].includes(status)) blockers.push(`remote execution status ${status}`);
  if (missingArtifacts.length > 0) blockers.push(`missing required artifacts: ${missingArtifacts.join(", ")}`);
  if (!resultCompleted) blockers.push(`improvement result is ${resultStatus ?? "missing"}${resultBlocker ? `: ${resultBlocker}` : ""}`);
  if (resultStatus === "completed") blockers.push(...validateExpansionResult(resultPayload));
  if (!profileSynced) blockers.push(`profile run id ${profileRunId ?? "missing"} does not match execution ${executionId}`);
  return {
    status: blockers.length === 0 ? "validated" : "blocked",
    executionStatus: status,
    missingArtifacts,
    resultStatus,
    resultBlocker,
    profileRunId,
    blockers,
  };
}

async function pollExecution(executionId, { origin, pollMs, timeoutMs }) {
  const started = Date.now();
  while (true) {
    const payload = await adminGet(`/api/admin/remote-agent-executions/${encodeURIComponent(executionId)}`, origin);
    const execution = payload.execution ?? payload.remoteAgentExecution ?? payload;
    if (["ready", "completed", "failed", "blocked", "cancelled", "canceled"].includes(execution?.status)) return execution;
    if (Date.now() - started > timeoutMs) return execution;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const datasetId = argValue(argv, "--dataset-id");
  assert(datasetId, "Usage: npm run canonical:dataset-expansion -- --dataset-id <id> [--dry-run] [--no-wait]");
  const dryRun = argv.includes("--dry-run");
  const noWait = argv.includes("--no-wait");
  const timestamp = argValue(argv, "--prompt-timestamp") ?? new Date().toISOString();
  let session = null;
  let dataset = null;
  let datasetName = datasetId;
  if (!dryRun) {
    session = readSession();
    const datasetPayload = await cliApi(session, `/api/cli/datasets/${encodeURIComponent(datasetId)}`);
    dataset = datasetPayload.dataset;
    assert(dataset, `Dataset ${datasetId} not found`);
    datasetName = dataset.name ?? datasetId;
  }
  const prompt = renderPrompt({ datasetId, datasetName });
  const promptPath = persistPrompt(datasetId, prompt, timestamp);
  const body = {
    prompt,
    kind: "dataset-improvement",
    datasetId,
    ownerType: "admin",
    execution: {
      provider: "modal",
      remoteAgentExecutionOwner: "service",
      userSessionRequired: false,
      codexMode: "tui",
      codexArgs: [
        "--dangerously-bypass-approvals-and-sandbox",
      ],
    },
    resources,
    artifactSpec,
    requiredArtifacts: artifactSpec.map((artifact) => artifact.path),
    metadata: {
      launchedBy: "scripts/dataset-expansion.mjs",
      canonicalDatasetLifecycle: true,
      canonicalJobKind: "dataset-improvement",
      jobKind: "dataset-improvement",
      operation: "dataset-expansion",
      canonicalMaintenanceMode: "dataset-expansion",
      datasetId,
      datasetName,
      writesDatasetBriefing: true,
      syncsDocsFromBriefing: true,
      sendsSlackLifecycleAlerts: true,
      requiresVolumeInventory: true,
      datasetDir: `/mnt/alpha-research/datasets/${datasetId}`,
      artifactContract: "work-report-briefing-result",
      requiresWritableDatasetDir: true,
    },
  };
  if (dryRun) {
    console.log(JSON.stringify({
      dryRun,
      datasetId,
      promptPath,
      endpoint,
      kind: body.kind,
      execution: body.execution,
      resources,
      artifactSpec,
      requiredArtifacts: body.requiredArtifacts,
      metadata: body.metadata,
    }, null, 2));
    return;
  }
  const { body: started } = await postAdminJson(endpoint, body, process.env.ALPHA_RESEARCH_ORIGIN ?? session.origin);
  const executionId = executionIdFromResponse(started);
  assert(executionId, "Admin response did not include execution id.");
  const origin = process.env.ALPHA_RESEARCH_ORIGIN ?? session.origin;
  const execution = noWait
    ? (started.execution ?? started.remoteAgentExecution ?? { id: executionId, status: "started" })
    : await pollExecution(executionId, {
      origin,
      pollMs: Number(process.env.CANONICAL_SIMPLE_POLL_MS ?? 30_000),
      timeoutMs: Number(process.env.CANONICAL_SIMPLE_TIMEOUT_MS ?? 45 * 60_000),
    });
  const artifactsPayload = await adminGet(`/api/admin/remote-agent-executions/${encodeURIComponent(executionId)}/artifacts`, origin);
  const readback = await cliApi(session, `/api/cli/datasets/${encodeURIComponent(datasetId)}`).catch(() => ({ dataset: null }));
  const validation = classifyDatasetExpansion({
    execution,
    artifacts: artifactsPayload.artifacts ?? [],
    dataset: readback.dataset,
    executionId,
  });
  const summary = summarizeDatasetExpansion({
    artifacts: artifactsPayload.artifacts ?? [],
    executionId,
    validation,
  });
  console.log(JSON.stringify({
    mode: "dataset-expansion",
    datasetId,
    promptPath,
    executionId,
    adminStatusUrl: adminExecutionStatusUrl(executionId, origin),
    artifactsUrl: adminExecutionArtifactsUrl(executionId, origin),
    validation,
    summaryTable: summary.summaryTable,
    briefingChanges: summary.briefingChanges,
  }, null, 2));
  if (validation.status !== "validated") process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
