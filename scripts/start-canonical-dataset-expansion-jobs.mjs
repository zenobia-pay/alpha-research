import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const sessionPath = process.env.RESEARCH_SESSION_PATH ?? join(homedir(), ".research", "session.json");
const promptPath = new URL("../prompts/canonical-dataset-expansion.md", import.meta.url);
const catalogPath = new URL("../docs/CANONICAL_PUBLIC_DATASETS.md", import.meta.url);

const dryRun = process.argv.includes("--dry-run") || process.env.CANONICAL_DATASET_EXPAND_DRY_RUN === "1";
const maxConcurrentRemoteRuns = Math.max(1, Math.trunc(Number(process.env.CANONICAL_MAX_CONCURRENT_REMOTE_RUNS ?? "2")));

const canonicalDatasets = [
  {
    id: "econ",
    name: "Econ",
    fieldBrief: "Economics: macroeconomics, labor, housing, inflation, credit, consumer behavior, regional economics, and business-cycle research.",
    seedCandidates: [
      "- Eurostat bulk download / SDMX API: https://ec.europa.eu/eurostat/ (active_fetchable)",
      "- European Central Bank SDW API: https://data.ecb.europa.eu/ (active_fetchable)",
      "- BIS statistics (SDMX): https://www.bis.org/statistics/ (active_fetchable)",
      "- World Bank WDI API: https://data.worldbank.org/ (active_fetchable)",
      "- OECD API / bulk downloads: https://data-explorer.oecd.org/ (active_fetchable)",
      "- OpenCorporates company registry: https://opencorporates.com/ (license_review)",
    ].join("\n"),
  },
];

const resources = {
  profile: "standard-analysis",
  backend: "modal",
  resourceProfile: "standard-analysis",
  cpu: 4,
  memoryGb: 8,
  workspaceDiskGb: 50,
  storageMode: "object-store-versioned",
  datasetAccess: "read-only-version",
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

function renderPrompt(template, dataset) {
  return template
    .replaceAll("{datasetId}", dataset.id)
    .replaceAll("{datasetName}", dataset.name)
    .replaceAll("{fieldBrief}", dataset.fieldBrief)
    .replaceAll("{fieldCatalogSources}", dataset.fieldCatalogSources ?? "- (No local field catalog sources found.)")
    .replaceAll("{seedCandidates}", dataset.seedCandidates ?? "- (No seed candidates.)");
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

const session = readSession();
const promptTemplate = readFileSync(promptPath, "utf8");
const catalogMarkdown = readFileSync(catalogPath, "utf8");
const results = [];

function extractCatalogSources(markdown, datasetId) {
  const headingNeedle = `(\`${datasetId}\`)`;
  const lines = markdown.split("\n");
  const startIndex = lines.findIndex((line) => line.startsWith("### ") && line.includes(headingNeedle));
  if (startIndex === -1) return null;
  const endIndex = lines.findIndex((line, idx) => idx > startIndex && line.startsWith("### "));
  const section = lines.slice(startIndex, endIndex === -1 ? lines.length : endIndex).join("\n");

  const startNeedles = ["Initial active/deferred source registry:", "Recommended starting sources:"];
  const endNeedle = "Priority normalized tables";

  let startPos = -1;
  let startNeedle = null;
  for (const needle of startNeedles) {
    const pos = section.indexOf(needle);
    if (pos !== -1) {
      startPos = pos;
      startNeedle = needle;
      break;
    }
  }
  if (startPos === -1 || !startNeedle) return null;

  const afterStart = section.slice(startPos + startNeedle.length);
  const endPos = afterStart.indexOf(endNeedle);
  const slice = (endPos === -1 ? afterStart : afterStart.slice(0, endPos)).trim();
  const bullets = slice
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().startsWith("- "));
  return bullets.length > 0 ? bullets.join("\n") : null;
}

let datasetsPayload;
try {
  datasetsPayload = await api(session, "/api/cli/datasets");
} catch (error) {
  results.push({
    status: "blocked_remote_unreachable",
    error: formatError(error),
    origin: session.origin,
  });
  console.log(JSON.stringify({ dryRun, results }, null, 2));
  process.exitCode = 2;
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
  dataset.fieldCatalogSources = extractCatalogSources(catalogMarkdown, dataset.id);
  const liveDataset = liveDatasets.get(dataset.id);
  if (!liveDataset) {
    results.push({ datasetId: dataset.id, status: "missing_dataset" });
    continue;
  }

  const datasetStatus = liveDataset.status ?? "unknown";
  const deploymentStatus = liveDataset.deploymentStatus ?? "unknown";
  const activeRunId = liveDataset.activeRunId ?? null;

  if (datasetStatus !== "ready" || deploymentStatus !== "ready") {
    results.push({ datasetId: dataset.id, status: "skipped_not_ready", datasetStatus, deploymentStatus, activeRunId });
    continue;
  }

  if (activeRunId) {
    results.push({ datasetId: dataset.id, status: "skipped_active_run", activeRunId });
    continue;
  }

  if (!dryRun && startedThisPass >= startAllowance) {
    results.push({
      datasetId: dataset.id,
      status: "skipped_run_cap_reached",
      maxConcurrentRemoteRuns,
      activeCanonicalRuns,
      startedThisPass,
    });
    continue;
  }

  const prompt = renderPrompt(promptTemplate, dataset);
  const body = {
    prompt,
    type: "analysis",
    config: {
      canonicalDatasetExpand: true,
      jobKind: "dataset-expansion",
      datasetId: dataset.id,
      datasetName: dataset.name,
      resources,
    },
    artifacts: [
      { type: "file", title: "Expansion Plan", path: "expansion_plan.md" },
      { type: "file", title: "source_registry.plan.json", path: "source_registry.plan.json" },
    ],
  };

  if (dryRun) {
    results.push({ datasetId: dataset.id, status: "dry_run_ready", promptLength: prompt.length, resources });
    continue;
  }

  try {
    const started = await api(session, `/api/cli/datasets/${encodeURIComponent(dataset.id)}/runs`, {
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

console.log(JSON.stringify({ dryRun, results }, null, 2));
const failed = results.filter((r) => ["missing_dataset", "failed_to_start", "blocked_remote_unreachable"].includes(r.status));
if (failed.length > 0) {
  process.exitCode = 1;
}
