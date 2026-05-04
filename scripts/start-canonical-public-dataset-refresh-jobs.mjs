import { readFileSync } from "node:fs";
import { lookup as dnsLookup } from "node:dns";
import { request as httpsRequest } from "node:https";
import { homedir } from "node:os";
import { join } from "node:path";

const sessionPath = process.env.RESEARCH_SESSION_PATH ?? join(homedir(), ".research", "session.json");
const catalogPath = new URL("../docs/CANONICAL_PUBLIC_DATASETS.md", import.meta.url);

const dryRun = process.argv.includes("--dry-run") || process.env.CANONICAL_DATASET_REFRESH_DRY_RUN === "1";
const statusOnly = process.argv.includes("--status-only");
const remoteStatusAttempts = Number(process.env.CANONICAL_REMOTE_STATUS_ATTEMPTS ?? "5");
const remoteStatusRetryBaseMs = Number(process.env.CANONICAL_REMOTE_STATUS_RETRY_BASE_MS ?? "2000");
const maxConcurrentRemoteRuns = Math.max(1, Math.trunc(Number(process.env.CANONICAL_MAX_CONCURRENT_REMOTE_RUNS ?? "2")));
const alphaResearchFallbackIps = (process.env.ALPHA_RESEARCH_FALLBACK_IPS ?? "104.21.25.66,172.67.223.109")
  .split(",")
  .map((ip) => ip.trim())
  .filter(Boolean);

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
  if (error && typeof error === "object" && typeof error.code === "string") return error.code;
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
    // Some sandboxed / policy-controlled environments surface outbound connect failures as EPERM.
    // Treat as transient so we can retry (and potentially rotate fallback IPs) instead of failing hard.
    "EPERM",
    "UND_ERR_CONNECT_TIMEOUT",
    "UND_ERR_HEADERS_TIMEOUT",
    "UND_ERR_SOCKET",
  ]);
  return transientCodes.has(errorCauseCode(error));
}

let alphaFallbackCursor = 0;

function lookupWithAlphaFallback(hostname, options, callback) {
  const opts = typeof options === "object" && options !== null ? options : {};
  const done = (address, family = 4) => {
    if (opts.all) {
      callback(null, [{ address, family }]);
      return;
    }
    callback(null, address, family);
  };

  const chooseFallback = () => {
    if (alphaResearchFallbackIps.length === 0) return null;
    const ip = alphaResearchFallbackIps[alphaFallbackCursor % alphaResearchFallbackIps.length];
    alphaFallbackCursor += 1;
    const family = ip.includes(":") ? 6 : 4;
    return { ip, family };
  };

  if (process.env.CANONICAL_FORCE_DNS_FALLBACK === "1" && hostname === "alpharesearch.nyc" && alphaResearchFallbackIps.length > 0) {
    const chosen = chooseFallback();
    if (chosen) done(chosen.ip, chosen.family);
    return;
  }

  dnsLookup(hostname, opts, (error, address, family) => {
    if (!error) {
      callback(null, address, family);
      return;
    }

    if (hostname === "alpharesearch.nyc" && isTransientRemoteError(error) && alphaResearchFallbackIps.length > 0) {
      const chosen = chooseFallback();
      console.warn(
        `DNS lookup for ${hostname} failed with ${error.code}; using configured fallback IP ${chosen?.ip ?? "(none)"}.`,
      );
      if (chosen) done(chosen.ip, chosen.family);
      return;
    }

    callback(error, address, family);
  });
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
  const url = new URL(path, session.origin);
  const bodyPayload = options.body === undefined ? undefined : JSON.stringify(options.body);
  const bodyText = await new Promise((resolve, reject) => {
    const request = httpsRequest({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || 443,
      path: `${url.pathname}${url.search}`,
      method: options.method ?? "GET",
      lookup: lookupWithAlphaFallback,
      servername: url.hostname,
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
        ...(bodyPayload === undefined ? {} : { "Content-Length": Buffer.byteLength(bodyPayload) }),
      },
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          const error = new Error(`Remote request failed (${response.statusCode ?? "unknown"}) for ${path}: ${text || "{}"}`);
          error.status = response.statusCode;
          error.body = text ? JSON.parse(text) : {};
          reject(error);
          return;
        }
        resolve(text);
      });
    });
    request.on("error", reject);
    if (bodyPayload !== undefined) request.write(bodyPayload);
    request.end();
  });
  const body = bodyText ? JSON.parse(bodyText) : {};
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
    "- Record every attempted raw source download in `download_inventory.jsonl` and `download_inventory.csv` before normalization.",
    "- Record every normalized output table/document in `normalization_inventory.jsonl` and `normalization_inventory.csv` before publishing.",
    "",
    "## Required published outputs (write these exact files at the dataset root and ensure they are published):",
    "- manifest.json",
    "- source_registry.csv",
    "- source_registry.plan.json",
    "- download_inventory.jsonl",
    "- download_inventory.csv",
    "- normalization_inventory.jsonl",
    "- normalization_inventory.csv",
    "- data_dictionary.md",
    "- quality_report.md",
    "- dataset_briefing.md",
    "",
    "## Download inventory required fields",
    "Each row/object must include `source_id`, `source_name`, `plain_english_description`, `canonical_url`, `request_url` with secrets redacted, `retrieved_at`, `retrieval_method`, `http_status`, `raw_path`, `raw_format`, `raw_bytes`, `content_hash_sha256`, `license`, `access_status`, and `failure_or_gating_reason`.",
    "",
    "## Normalization inventory required fields",
    "Each row/object must include `output_id`, `output_path`, `plain_english_description`, `source_ids`, `input_paths`, `normalized_at`, `output_format`, `grain`, `primary_key`, `join_keys`, `time_coverage`, `geography_coverage`, `row_count`, `column_count`, `schema`, `transform_steps`, `quality_checks`, and `content_hash_sha256`.",
    "",
    "## Source catalog for this field (starting point)",
    sourceRegistryBullets ?? "- (Missing from local catalog; proceed by inspecting the mounted dataset and preserving any existing source registry.)",
    "",
    "## Notes",
    "- If source_registry.plan.json exists already, update it; do not discard deferred items.",
    "- `manifest.json`, `data_dictionary.md`, `quality_report.md`, and `dataset_briefing.md` must summarize the download and normalization inventories. A final row count without source and transform provenance is not sufficient.",
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
        "download_inventory.jsonl",
        "download_inventory.csv",
        "normalization_inventory.jsonl",
        "normalization_inventory.csv",
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
      { type: "file", title: "download_inventory.jsonl", path: "download_inventory.jsonl" },
      { type: "file", title: "download_inventory.csv", path: "download_inventory.csv" },
      { type: "file", title: "normalization_inventory.jsonl", path: "normalization_inventory.jsonl" },
      { type: "file", title: "normalization_inventory.csv", path: "normalization_inventory.csv" },
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
