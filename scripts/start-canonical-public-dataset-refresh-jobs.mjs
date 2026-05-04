import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const sessionPath = process.env.RESEARCH_SESSION_PATH ?? join(homedir(), ".research", "session.json");
const catalogPath = new URL("../docs/CANONICAL_PUBLIC_DATASETS.md", import.meta.url);

const dryRun = process.argv.includes("--dry-run") || process.env.CANONICAL_DATASET_REFRESH_DRY_RUN === "1";
const statusOnly = process.argv.includes("--status-only");
const remoteStatusAttempts = Number(process.env.CANONICAL_REMOTE_STATUS_ATTEMPTS ?? "5");
const remoteStatusRetryBaseMs = Number(process.env.CANONICAL_REMOTE_STATUS_RETRY_BASE_MS ?? "2000");
const maxConcurrentRemoteRuns = Math.max(1, Math.trunc(Number(process.env.CANONICAL_MAX_CONCURRENT_REMOTE_RUNS ?? "2")));

const canonicalDatasets = [
  { id: "econ", name: "Econ" },
  { id: "sociology", name: "Sociology" },
  { id: "philosophy", name: "Philosophy" },
  { id: "history", name: "History" },
  { id: "literature", name: "Literature" },
  { id: "political-science", name: "Political Science" },
  { id: "anthropology", name: "Anthropology" },
  { id: "linguistics", name: "Linguistics" },
  { id: "classics", name: "Classics" },
];

const CANONICAL_PUBLIC_RESOURCES = {
  profile: "canonical-public",
  runnerSize: "s-4vcpu-8gb",
  workspaceDiskGb: 50,
  storageMode: "object-store-versioned",
  datasetAccess: "read-only-version",
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorCauseCode(error) {
  const cause = error instanceof Error ? error.cause : null;
  return cause && typeof cause === "object" && typeof cause.code === "string" ? cause.code : null;
}

function isTransientRemoteError(error) {
  const transientCodes = new Set([
    "EAI_AGAIN",
    "ENOTFOUND",
    "ECONNRESET",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "UND_ERR_CONNECT_TIMEOUT",
    "UND_ERR_HEADERS_TIMEOUT",
    "UND_ERR_SOCKET",
  ]);
  return transientCodes.has(errorCauseCode(error));
}

function readSession() {
  const raw = readFileSync(sessionPath, "utf8");
  const session = JSON.parse(raw);
  assert(typeof session.origin === "string" && session.origin.startsWith("http"), `Invalid session origin in ${sessionPath}.`);
  assert(typeof session.accessToken === "string" && session.accessToken.length > 0, `Missing access token in ${sessionPath}.`);
  return session;
}

function dashboardRunUrl(origin, runId) {
  const dashboardOrigin = process.env.ALPHA_RESEARCH_DASHBOARD_ORIGIN ?? "https://dashboard.alpharesearch.nyc";
  const url = new URL(dashboardOrigin);
  url.searchParams.set("view", "runs");
  url.searchParams.set("runId", runId);
  url.hash = `run-${encodeURIComponent(runId)}`;
  return url.toString();
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

async function apiWithRetry(session, path, options = {}) {
  const attempts = Math.max(1, Math.trunc(options.attempts ?? remoteStatusAttempts));
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await api(session, path, options);
    } catch (error) {
      lastError = error;
      if (!isTransientRemoteError(error) || attempt === attempts) {
        throw error;
      }

      const delayMs = remoteStatusRetryBaseMs * attempt;
      console.warn(
        `Remote status check failed with ${errorCauseCode(error)}; retrying in ${delayMs}ms (${attempt}/${attempts}).`,
      );
      await sleep(delayMs);
    }
  }

  throw lastError;
}

function extractSourceRegistrySection(markdown, datasetId) {
  const headingNeedle = `(\`${datasetId}\`)`;
  const lines = markdown.split("\n");
  const startIndex = lines.findIndex((line) => line.startsWith("### ") && line.includes(headingNeedle));
  if (startIndex === -1) return null;
  const endIndex = lines.findIndex((line, idx) => idx > startIndex && line.startsWith("### "));
  const section = lines.slice(startIndex, endIndex === -1 ? lines.length : endIndex).join("\n");

  const startNeedle = "Initial active/deferred source registry:";
  const endNeedle = "Priority normalized tables/documents:";
  const startPos = section.indexOf(startNeedle);
  if (startPos === -1) return null;
  const afterStart = section.slice(startPos + startNeedle.length);
  const endPos = afterStart.indexOf(endNeedle);
  const slice = (endPos === -1 ? afterStart : afterStart.slice(0, endPos)).trim();
  const bullets = slice
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().startsWith("- "));
  return bullets.length > 0 ? bullets.join("\n") : null;
}

function refreshPrompt(datasetId, datasetName, sourceRegistryBullets) {
  return [
    `# Canonical Public Dataset Refresh: ${datasetName} (\`${datasetId}\`)`,
    "",
    "You are running a canonical public-data refresh. Treat all work as public-data only.",
    "",
    "## Operating contract (must follow)",
    "- Skip or defer any credentialed, paid, unclear-license, or brittle/anti-bot sources; do not fail the build for these.",
    "- Prefer stable government/academic/open-repo sources; keep provenance (URLs, fetch dates, license notes).",
    "- If an existing canonical dataset version is mounted, extend it rather than starting from scratch.",
    "",
    "## Required published outputs (write these exact files at the dataset root and ensure they are published):",
    "- manifest.json",
    "- source_registry.csv",
    "- source_registry.plan.json",
    "- data_dictionary.md",
    "- quality_report.md",
    "- dataset_briefing.md",
    "",
    "## Source catalog for this field (starting point)",
    sourceRegistryBullets ?? "- (Missing from local catalog; proceed by inspecting the mounted dataset and preserving any existing source registry.)",
    "",
    "## Notes",
    "- If source_registry.plan.json exists already, update it; do not discard deferred items.",
    "- Quality report should explicitly call out missing coverage and deferred sources, but must still succeed.",
  ].join("\n");
}

const session = readSession();
const catalogMarkdown = readFileSync(catalogPath, "utf8");
const results = [];

let datasetsPayload;
try {
  datasetsPayload = await apiWithRetry(session, "/api/cli/datasets");
} catch (error) {
  const formatted = formatError(error);
  if (!dryRun) {
    results.push({
      status: "blocked_remote_unreachable",
      error: formatted,
      origin: session.origin,
    });

    for (const dataset of canonicalDatasets) {
      results.push({
        datasetId: dataset.id,
        status: "remote_status_unavailable",
        datasetStatus: "unknown",
        deploymentStatus: "unknown",
        activeRunId: null,
        error: formatted,
        origin: session.origin,
      });
    }

    console.log(JSON.stringify({ dryRun, statusOnly, results }, null, 2));
    process.exitCode = 2;
    process.exit();
  }

  // Offline dry-run mode: remote may be unreachable in sandboxed environments.
  // Emit planned prompts/resources without needing live dataset readiness checks.
  results.push({
    status: "offline_dry_run_remote_unreachable",
    error: formatted,
    origin: session.origin,
  });

  for (const dataset of canonicalDatasets) {
    const sourceRegistryBullets = extractSourceRegistrySection(catalogMarkdown, dataset.id);
    const prompt = refreshPrompt(dataset.id, dataset.name, sourceRegistryBullets);
    results.push({
      datasetId: dataset.id,
      status: "offline_dry_run_planned",
      promptLength: prompt.length,
      resources: CANONICAL_PUBLIC_RESOURCES,
      artifacts: [
        "manifest.json",
        "source_registry.csv",
        "source_registry.plan.json",
        "data_dictionary.md",
        "quality_report.md",
        "dataset_briefing.md",
      ],
    });
  }

  console.log(JSON.stringify({ dryRun, statusOnly, results }, null, 2));
  process.exitCode = 0;
  process.exit();
}

const liveDatasets = new Map((datasetsPayload.datasets ?? []).map((dataset) => [dataset.id, dataset]));
const activeCanonicalRuns = canonicalDatasets.filter((dataset) => {
  const liveDataset = liveDatasets.get(dataset.id);
  return Boolean(liveDataset?.activeRunId);
}).length;
const startAllowance = Math.max(0, maxConcurrentRemoteRuns - activeCanonicalRuns);
let startedThisPass = 0;

for (const dataset of canonicalDatasets) {
  const liveDataset = liveDatasets.get(dataset.id);
  if (!liveDataset) {
    results.push({ datasetId: dataset.id, status: "missing_dataset" });
    continue;
  }

  const datasetStatus = liveDataset.status ?? "unknown";
  const deploymentStatus = liveDataset.deploymentStatus ?? "unknown";
  const activeRunId = liveDataset.activeRunId ?? null;

  if (statusOnly) {
    results.push({ datasetId: dataset.id, status: "remote_status", datasetStatus, deploymentStatus, activeRunId });
    continue;
  }

  if (datasetStatus !== "ready" || deploymentStatus !== "ready") {
    results.push({ datasetId: dataset.id, status: "skipped_not_ready", datasetStatus, deploymentStatus, activeRunId });
    continue;
  }

  if (activeRunId) {
    results.push({ datasetId: dataset.id, status: "skipped_active_run", datasetStatus, deploymentStatus, activeRunId });
    continue;
  }

  if (!dryRun && startedThisPass >= startAllowance) {
    results.push({
      datasetId: dataset.id,
      status: "skipped_run_cap_reached",
      datasetStatus,
      deploymentStatus,
      activeRunId,
      maxConcurrentRemoteRuns,
      activeCanonicalRuns,
      startedThisPass,
    });
    continue;
  }

  const sourceRegistryBullets = extractSourceRegistrySection(catalogMarkdown, dataset.id);
  const prompt = refreshPrompt(dataset.id, dataset.name, sourceRegistryBullets);

  const body = {
    name: dataset.name,
    description: `Canonical public dataset refresh for ${dataset.name}.`,
    sourceDescription: `Canonical public sources for ${dataset.name}.`,
    prompt,
    resources: CANONICAL_PUBLIC_RESOURCES,
    artifacts: [
      { type: "file", title: "manifest.json", path: "manifest.json" },
      { type: "file", title: "source_registry.csv", path: "source_registry.csv" },
      { type: "file", title: "source_registry.plan.json", path: "source_registry.plan.json" },
      { type: "file", title: "data_dictionary.md", path: "data_dictionary.md" },
      { type: "file", title: "quality_report.md", path: "quality_report.md" },
      { type: "file", title: "dataset_briefing.md", path: "dataset_briefing.md" },
    ],
  };

  if (dryRun) {
    results.push({
      datasetId: dataset.id,
      status: "dry_run_ready",
      promptLength: prompt.length,
      resources: CANONICAL_PUBLIC_RESOURCES,
    });
    continue;
  }

  try {
    const started = await api(session, `/api/cli/datasets/${encodeURIComponent(dataset.id)}/public-environment`, {
      method: "POST",
      body,
    });
    const runId = started.run?.id ?? null;
    results.push({
      datasetId: dataset.id,
      status: "started",
      runId,
      dashboardUrl: runId ? dashboardRunUrl(session.origin, runId) : null,
    });
    startedThisPass += 1;
  } catch (error) {
    results.push({
      datasetId: dataset.id,
      status: "failed_to_start",
      error: formatError(error),
    });
  }
}

console.log(JSON.stringify({ dryRun, statusOnly, results }, null, 2));
const failed = results.filter((r) => ["missing_dataset", "failed_to_start", "blocked_remote_unreachable"].includes(r.status));
if (failed.length > 0) {
  process.exitCode = 1;
}
