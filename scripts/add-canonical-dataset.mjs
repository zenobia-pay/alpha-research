import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { CANONICAL_DATASETS, seedCandidatesText } from "./canonical-dataset-catalog.mjs";

const defaultOrigin = process.env.ALPHA_RESEARCH_ORIGIN ?? "https://alpharesearch.nyc";
const adminTokenPath = process.env.ALPHA_RESEARCH_ADMIN_TOKEN_PATH ?? join(homedir(), ".codex", "secrets.env");
const dryRun = process.argv.includes("--dry-run");
const legacyPublicEnvironment = process.argv.includes("--legacy-public-environment");

const resources = {
  backend: "modal",
  resourceProfile: "canonical-public",
  cpu: 4,
  memoryGb: 8,
  workspaceDiskGb: 50,
  storageMode: "object-store-versioned",
  datasetAccess: "write-version",
  publishMode: "versioned",
};

const requiredDatasetArtifacts = [
  "manifest.json",
  "source_registry.csv",
  "source_registry.plan.json",
  "download_inventory.jsonl",
  "download_inventory.csv",
  "download_events.jsonl",
  "slack_download_alerts.jsonl",
  "slack_briefing.md",
  "raw_inventory.jsonl",
  "raw_inventory.csv",
  "volume_inventory.jsonl",
  "volume_inventory.csv",
  "volume_inventory_summary.json",
  "volume_tree.txt",
  "data_dictionary.md",
  "quality_report.md",
  "dataset_briefing.md",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  assert(value && !value.startsWith("--"), `Missing value for ${name}`);
  return value;
}

function slugify(input) {
  return input
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function readPrompt() {
  const prompt = argValue("--prompt");
  const promptFile = argValue("--prompt-file");
  assert(!(prompt && promptFile), "Use either --prompt or --prompt-file, not both.");
  if (promptFile) return readFileSync(promptFile, "utf8").trim();
  assert(prompt, "Usage: npm run canonical:add -- --name <name> --prompt <starter instructions> [--id <slug>] [--dry-run]");
  return prompt.trim();
}

function readAdminToken() {
  if (process.env.ALPHA_RESEARCH_ADMIN_TOKEN) return process.env.ALPHA_RESEARCH_ADMIN_TOKEN;
  if (!existsSync(adminTokenPath)) return null;
  const envText = readFileSync(adminTokenPath, "utf8");
  const match = envText.match(/^ALPHA_RESEARCH_ADMIN_TOKEN=(.*)$/mu);
  return match?.[1]?.trim().replace(/^['"]|['"]$/g, "") || null;
}

function catalogSeedText(datasetId) {
  const catalogEntry = CANONICAL_DATASETS.find((dataset) => dataset.id === datasetId);
  return catalogEntry ? seedCandidatesText(catalogEntry) : "- No existing catalog seeds. Use the starter instructions to identify stable public/open sources.";
}

function bootstrapPrompt({ datasetId, name, starterPrompt }) {
  return [
    `Bootstrap canonical public dataset: ${name} (${datasetId}).`,
    "",
    "Dataset intent from operator:",
    starterPrompt,
    "",
    "Instructions:",
    "- Create or use the platform-owned Modal dataset volume for this dataset id.",
    "- Pull only stable public/open sources that match the operator intent.",
    "- Keep provider-native raw files and source-specific documentation; do not produce analysis-ready joined tables as canonical artifacts.",
    "- Classify each source as active_fetchable, deferred_fetchable, license_review, credential_required, or reject.",
    "- Send Slack download alerts through the platform canonical dataset Slack secret for every terminal source attempt.",
    "- Write the required dataset artifacts and update the dataset profile from dataset_briefing.md.",
    "",
    "Initial catalog seeds if applicable:",
    catalogSeedText(datasetId),
  ].join("\n");
}

function bootstrapPayload({ datasetId, name, starterPrompt }) {
  return {
    datasetId,
    name,
    sourceType: "public_data",
    owner: "platform",
    execution: {
      provider: "modal",
      jobKind: "canonical-dataset-bootstrap",
      codexRunOwner: "service",
      userSessionRequired: false,
    },
    resources,
    prompt: bootstrapPrompt({ datasetId, name, starterPrompt }),
    starterPrompt,
    requiredEnvironment: [
      "CANONICAL_DATASET_SLACK_WEBHOOK_URL",
    ],
    optionalEnvironment: [
      "EXA_API_KEY",
    ],
    requiredArtifacts: requiredDatasetArtifacts,
    docsMirrors: [
      `docs/public-datasets/briefings/${datasetId}.md`,
      `docs/public-datasets/${datasetId}.mdx`,
    ],
  };
}

async function postJson(url, token, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`Canonical bootstrap request failed (${response.status}) for ${url}: ${text || "{}"}`);
  }
  return parsed;
}

async function main() {
  const name = argValue("--name");
  assert(name, "Usage: npm run canonical:add -- --name <name> --prompt <starter instructions> [--id <slug>] [--dry-run]");
  const datasetId = argValue("--id") ?? slugify(name);
  assert(datasetId, "Dataset id resolved to an empty slug.");
  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(datasetId), `Invalid dataset id "${datasetId}". Use lowercase slug format.`);
  const starterPrompt = readPrompt();
  const body = bootstrapPayload({ datasetId, name, starterPrompt });

  if (dryRun) {
    console.log(JSON.stringify({
      dryRun: true,
      endpoint: legacyPublicEnvironment
        ? `/api/cli/datasets/${datasetId}/public-environment`
        : "/api/admin/canonical-datasets/bootstrap",
      body,
    }, null, 2));
    return;
  }

  if (legacyPublicEnvironment) {
    throw new Error("Refusing to use --legacy-public-environment by default. The best path is platform-owned /api/admin/canonical-datasets/bootstrap.");
  }

  const token = readAdminToken();
  assert(token, `Missing ALPHA_RESEARCH_ADMIN_TOKEN. Store it with ~/.codex/scripts/ask-secret.sh ALPHA_RESEARCH_ADMIN_TOKEN ${adminTokenPath} "Enter Alpha Research admin token"`);
  const endpoint = new URL("/api/admin/canonical-datasets/bootstrap", defaultOrigin).toString();
  const result = await postJson(endpoint, token, body);
  console.log(JSON.stringify({
    datasetId,
    status: "submitted",
    endpoint,
    result,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
