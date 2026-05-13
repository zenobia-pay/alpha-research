import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { selectCanonicalDatasets, seedCandidatesText } from "./canonical-dataset-catalog.mjs";

const sessionPath = process.env.RESEARCH_SESSION_PATH ?? join(homedir(), ".research", "session.json");
const dryRun = process.argv.includes("--dry-run");
const idArg = process.argv.find((arg, index) => index > 1 && !arg.startsWith("--"));

const resources = {
  profile: "canonical-public",
  backend: "modal",
  resourceProfile: "canonical-public",
  cpu: 4,
  memoryGb: 8,
  workspaceDiskGb: 50,
  storageMode: "object-store-versioned",
  datasetAccess: "write-version",
  publishMode: "versioned",
};

const runtimeArtifacts = [
  { type: "file", title: "report.html", path: "report.html" },
  { type: "file", title: "work.md", path: "work.md" },
];

const datasetArtifacts = [
  { type: "file", title: "manifest.json", path: "manifest.json" },
  { type: "file", title: "source_registry.csv", path: "source_registry.csv" },
  { type: "file", title: "source_registry.plan.json", path: "source_registry.plan.json" },
  { type: "file", title: "download_inventory.jsonl", path: "download_inventory.jsonl" },
  { type: "file", title: "download_inventory.csv", path: "download_inventory.csv" },
  { type: "file", title: "download_events.jsonl", path: "download_events.jsonl" },
  { type: "file", title: "slack_download_alerts.jsonl", path: "slack_download_alerts.jsonl" },
  { type: "file", title: "slack_briefing.md", path: "slack_briefing.md" },
  { type: "file", title: "raw_inventory.jsonl", path: "raw_inventory.jsonl" },
  { type: "file", title: "raw_inventory.csv", path: "raw_inventory.csv" },
  { type: "file", title: "volume_inventory.jsonl", path: "volume_inventory.jsonl" },
  { type: "file", title: "volume_inventory.csv", path: "volume_inventory.csv" },
  { type: "structured_result", title: "volume_inventory_summary.json", path: "volume_inventory_summary.json" },
  { type: "file", title: "volume_tree.txt", path: "volume_tree.txt" },
  { type: "file", title: "data_dictionary.md", path: "data_dictionary.md" },
  { type: "file", title: "quality_report.md", path: "quality_report.md" },
  { type: "file", title: "dataset_briefing.md", path: "dataset_briefing.md" },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readSession() {
  const session = JSON.parse(readFileSync(sessionPath, "utf8"));
  assert(typeof session.origin === "string" && session.origin.startsWith("http"), `Invalid session origin in ${sessionPath}.`);
  assert(typeof session.accessToken === "string" && session.accessToken.length > 0, `Missing access token in ${sessionPath}.`);
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
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`Remote request failed (${response.status}) for ${path}: ${text || "{}"}`);
  }
  return body;
}

function dashboardRunUrl(runId) {
  const url = new URL(process.env.ALPHA_RESEARCH_DASHBOARD_ORIGIN ?? "https://dashboard.alpharesearch.nyc");
  url.searchParams.set("view", "runs");
  url.searchParams.set("runId", runId);
  url.hash = `run-${encodeURIComponent(runId)}`;
  return url.toString();
}

function promptFor(dataset) {
  return [
    `Create canonical public dataset ${dataset.id} (${dataset.name}).`,
    "",
    "Use the mounted Modal dataset folder. First create runtime artifacts `report.html` and `work.md` in the worker artifact output area, not in the dataset folder.",
    "Fetch only stable public/open sources. Skip gated or unclear-license sources and record why.",
    "Write provider-native raw files plus manifest, source registry, download inventory, raw inventory, volume inventory, data dictionary, quality report, Slack logs, and dataset_briefing.md.",
    "Send one Slack webhook message per terminal download attempt using CANONICAL_DATASET_SLACK_WEBHOOK_URL; if unavailable, log pending payloads without failing.",
    "Update the remote dataset profile from dataset_briefing.md and verify readback.",
    "",
    "Starting sources:",
    seedCandidatesText(dataset),
  ].join("\n");
}

async function main() {
  assert(idArg, "Usage: npm run canonical:add -- <dataset-id> [--dry-run]");
  const [dataset] = selectCanonicalDatasets(idArg);
  const prompt = promptFor(dataset);
  const body = {
    name: dataset.name,
    description: `Canonical public dataset bootstrap for ${dataset.name}.`,
    sourceDescription: `Canonical public sources for ${dataset.name}.`,
    prompt,
    resources,
    config: {
      canonicalDatasetLifecycle: true,
      jobKind: "dataset-bootstrap",
      datasetId: dataset.id,
      datasetName: dataset.name,
      writesDatasetBriefing: true,
      syncsDocsFromBriefing: true,
      requiresVolumeInventory: true,
      requiresDownloadEventLog: true,
      requiresSlackDownloadAlerts: true,
      requiresCodexLogin: true,
      requiredEnvironment: ["CANONICAL_DATASET_SLACK_WEBHOOK_URL"],
      optionalEnvironment: ["EXA_API_KEY"],
    },
    artifacts: [
      ...runtimeArtifacts,
      ...datasetArtifacts,
      { type: "file", title: "docs briefing mirror", path: `docs/public-datasets/briefings/${dataset.id}.md` },
      { type: "file", title: "docs dataset page", path: `docs/public-datasets/${dataset.id}.mdx` },
    ],
  };

  if (dryRun) {
    console.log(JSON.stringify({
      dryRun: true,
      datasetId: dataset.id,
      prompt,
      resources,
      runtimeArtifacts: runtimeArtifacts.map((artifact) => artifact.path),
      datasetArtifacts: datasetArtifacts.map((artifact) => artifact.path),
    }, null, 2));
    return;
  }

  const session = readSession();
  const started = await api(session, `/api/cli/datasets/${encodeURIComponent(dataset.id)}/public-environment`, {
    method: "POST",
    body,
  });
  const runId = started.run?.id ?? null;
  console.log(JSON.stringify({
    datasetId: dataset.id,
    status: "started",
    runId,
    dashboardUrl: runId ? dashboardRunUrl(runId) : null,
    dataset: started.dataset ?? null,
    environment: started.environment ?? null,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
