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
  const template = readFileSync(new URL("../prompts/canonical-simple-maintain.md", import.meta.url), "utf8");
  return template.replaceAll("{datasetId}", datasetId).replaceAll("{datasetName}", datasetName);
}

export function promptRecordPath(datasetId, timestamp = new Date().toISOString()) {
  return `docs/canonical-runs/${datasetId}/${timestamp.replaceAll(/[:.]/g, "-")}/simple-maintain-prompt.md`;
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

export function classifySimpleMaintenance({ execution, artifacts, dataset, executionId }) {
  const status = execution?.status ?? "unknown";
  const missingArtifacts = artifactSpec.map((artifact) => artifact.path).filter((path) => !hasArtifact(artifacts, path));
  const resultPayload = artifactPayload(artifacts, "improvement_result.json");
  let resultStatus = null;
  let resultBlocker = null;
  if (typeof resultPayload === "string" && resultPayload.trim()) {
    try {
      const parsed = JSON.parse(resultPayload);
      resultStatus = parsed.status ?? null;
      resultBlocker = parsed.blocker ?? null;
    } catch {
      resultStatus = "invalid_json";
    }
  } else if (resultPayload && typeof resultPayload === "object") {
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
  assert(datasetId, "Usage: npm run canonical:simple-maintain -- --dataset-id <id> [--dry-run] [--no-wait]");
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
      launchedBy: "scripts/canonical-simple-maintain.mjs",
      canonicalDatasetLifecycle: true,
      canonicalJobKind: "dataset-improvement",
      jobKind: "dataset-improvement",
      operation: "simple-maintenance",
      canonicalMaintenanceMode: "simple",
      datasetId,
      datasetName,
      writesDatasetBriefing: true,
      syncsDocsFromBriefing: true,
      requiresVolumeInventory: true,
      datasetDir: `/mnt/alpha-research/datasets/${datasetId}`,
      datasetDirFallbacks: [`/data/datasets/${datasetId}`, "./dataset"],
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
  const validation = classifySimpleMaintenance({
    execution,
    artifacts: artifactsPayload.artifacts ?? [],
    dataset: readback.dataset,
    executionId,
  });
  console.log(JSON.stringify({
    mode: "simple-maintain",
    datasetId,
    promptPath,
    executionId,
    adminStatusUrl: adminExecutionStatusUrl(executionId, origin),
    artifactsUrl: adminExecutionArtifactsUrl(executionId, origin),
    validation,
  }, null, 2));
  if (validation.status !== "validated") process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
