import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";

import {
  artifactContract,
  CANONICAL_RUNTIME_CONTRACT,
  classifyDatasetStatus,
  loadSourceCatalog,
  parseArgs,
  promptRecordPath,
  renderPrompt,
} from "./canonical-dataset.ts";

test("canonical dataset args require create contract", () => {
  assert.deepEqual(parseArgs([
    "create",
    "--dataset-id",
    "medieval-studies",
    "--name",
    "Medieval Studies",
    "--field-brief",
    "Manuscripts and medieval corpora.",
    "--source",
    "e-codices: https://www.e-codices.unifr.ch/",
    "--dry-run",
  ]).mode, "create");

  assert.throws(
    () => parseArgs(["create", "--dataset-id", "medieval-studies", "--name", "Medieval Studies"]),
    /--field-brief is required/u,
  );
});

test("source catalog loads from file and inline sources", async () => {
  const root = await mkdtemp(join(tmpdir(), "canonical-sources-"));
  try {
    const sourcePath = join(root, "sources.md");
    await writeFile(sourcePath, "- Internet Archive: https://archive.org/\n", "utf8");
    const catalog = await loadSourceCatalog({
      sources: sourcePath,
      source: ["Project Gutenberg: https://www.gutenberg.org/"],
    });
    assert.match(catalog, /Internet Archive/u);
    assert.match(catalog, /- Project Gutenberg: https:\/\/www\.gutenberg\.org\//u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("build prompt includes mandatory disk-backed inventory and docs contract", async () => {
  const prompt = await renderPrompt("create", {
    datasetId: "medieval-studies",
    datasetName: "Medieval Studies",
    fieldBrief: "Medieval manuscripts, charters, places, people, and corpora.",
    sourceCatalog: "- e-codices: https://www.e-codices.unifr.ch/",
  });
  for (const required of [
    "download_inventory.jsonl",
    "download_events.jsonl",
    "slack_download_alerts.jsonl",
    "slack_briefing.md",
    "raw_inventory.jsonl",
    "volume_inventory.jsonl",
    "volume_inventory_summary.json",
    "volume_tree.txt",
    "dataset_briefing.md",
    "docs/public-datasets/briefings/medieval-studies.md",
    "docs/public-datasets/medieval-studies.mdx",
    "for every attempted source download",
    "CANONICAL_DATASET_SLACK_WEBHOOK_URL",
    "Slack webhook message",
    "plain-English data summary",
    "geographic coverage",
    "time coverage",
    "unit or measure",
    "schema/columns",
    "one-line headline",
    "what data is actually on disk, at what grain, where, for what dates, and with what caveats",
    "next action",
    "Do not send thin alerts",
    "# Literal Data Inventory",
    "one concrete dataset/file/API response/document collection in plain English before mentioning its path",
    "# Blocked Or Missing Data",
    "# Non-Data Artifacts On Disk",
    "POST /api/cli/datasets/medieval-studies/profile",
    "read back `GET /api/cli/datasets/medieval-studies`",
    "Do not delete active runtime directories during the run",
    "what is not present",
    "not address-level, county-level, metro-level, or transaction-level unless the inventory proves it",
    "authenticated Codex CLI/session",
    "/mnt/alpha-research/datasets/medieval-studies",
    "one row/object for every file",
    "Generate `dataset_briefing.md` only from `download_inventory.*`, `raw_inventory.*`, and `volume_inventory.*`",
  ]) {
    assert.match(prompt, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  }
});

test("artifact contract exposes all required create artifacts", () => {
  const paths = artifactContract("medieval-studies", "create").map((artifact) => artifact.path);
  for (const required of [
    "manifest.json",
    "download_inventory.jsonl",
    "download_events.jsonl",
    "slack_download_alerts.jsonl",
    "slack_briefing.md",
    "raw_inventory.jsonl",
    "volume_inventory.jsonl",
    "volume_inventory.csv",
    "volume_inventory_summary.json",
    "volume_tree.txt",
    "dataset_briefing.md",
    "docs/public-datasets/briefings/medieval-studies.md",
    "docs/public-datasets/medieval-studies.mdx",
  ]) {
    assert.ok(paths.includes(required), `Missing ${required}`);
  }
});

test("audit contract includes download event and Slack alert artifacts", () => {
  const paths = artifactContract("medieval-studies", "audit").map((artifact) => artifact.path);
  assert.ok(paths.includes("download_events.jsonl"));
  assert.ok(paths.includes("slack_download_alerts.jsonl"));
  assert.ok(paths.includes("slack_briefing.md"));
});

test("audit prompt requires rich Slack alert backfills", async () => {
  const prompt = await renderPrompt("audit", {
    datasetId: "econ",
    datasetName: "Economics",
    fieldBrief: "Economic source package.",
    sourceCatalog: "- fred: https://fred.stlouisfed.org/",
  });
  for (const required of [
    "must understand what the data actually is, not just the file name or path",
    "plain-English data summary",
    "observations/entities",
    "geographic coverage",
    "time coverage",
    "unit or measure",
    "schema/columns",
    "one-line headline",
    "what data is actually on disk, at what grain, where, for what dates, and with what caveats",
    "next action",
    "Do not send or backfill thin alerts",
    "# Literal Data Inventory",
    "one concrete dataset/file/API response/document collection in plain English before mentioning its path",
    "# Blocked Or Missing Data",
    "# Non-Data Artifacts On Disk",
    "POST /api/cli/datasets/econ/profile",
    "read back `GET /api/cli/datasets/econ`",
    "Do not delete active runtime directories during the run",
    "not address-level, county-level, metro-level, or transaction-level unless the inventory proves it",
    "rewrite or supersede it with an enriched row",
    "Update the CLI-visible dataset profile after the audit",
    "quality.slackAlertsPending",
    "Do not mark Slack as sent unless delivery was actually confirmed",
  ]) {
    assert.match(prompt, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  }
});

test("improve prompt requires docs mirrors and CLI proof update", async () => {
  const prompt = await renderPrompt("improve", {
    datasetId: "econ",
    datasetName: "Economics",
    fieldBrief: "Economic source package expansion.",
    sourceCatalog: "- fred: https://fred.stlouisfed.org/",
  });
  for (const required of [
    "update all three public/CLI surfaces from the same inventory-derived briefing",
    "docs/public-datasets/briefings/econ.md",
    "docs/public-datasets/econ.mdx",
    "the CLI-visible dataset profile returned by `GET /api/cli/datasets/econ`",
    "briefingMarkdown",
    "quality.diskInventoryProven: true",
    "quality.volumeInventoryRunId",
    "quality.slackAlertsSent",
    "quality.slackAlertsPending",
    "Do not mark Slack as sent unless delivery was actually confirmed",
    "Provider-level access failures are not run-level blockers",
    "Do not stop the whole run after BLS, FHFA, Treasury, or any other single provider blocks",
    "Do not send thin alerts",
    "what data is actually on disk, at what grain, where, for what dates, and with what caveats",
    "# Literal Data Inventory",
    "one concrete dataset/file/API response/document collection in plain English before mentioning its path",
    "briefingMarkdown` set to the exact `dataset_briefing.md` body",
    "read back `GET /api/cli/datasets/econ`",
    "# Blocked Or Missing Data",
    "# Non-Data Artifacts On Disk",
    "Do not delete active runtime directories during the run",
  ]) {
    assert.match(prompt, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  }
});

test("runtime contract requires Codex login and Slack webhook", () => {
  assert.equal(CANONICAL_RUNTIME_CONTRACT.requiresCodexLogin, true);
  assert.ok(CANONICAL_RUNTIME_CONTRACT.requiredEnvironment.includes("CANONICAL_DATASET_SLACK_WEBHOOK_URL"));
});

test("status classifier distinguishes missing, active, failed, unproven, and disk-proven datasets", () => {
  assert.equal(classifyDatasetStatus(null).status, "missing_dataset");
  assert.equal(classifyDatasetStatus({
    id: "x",
    status: "ready",
    deploymentStatus: "ready",
    activeRunId: "run-active",
  }).status, "active_run");
  assert.equal(classifyDatasetStatus({ id: "x", status: "failed", deploymentStatus: "failed" }).status, "failed_deployment");
  assert.equal(classifyDatasetStatus({ id: "x", status: "ready", deploymentStatus: "ready", profile: {} }).status, "not_disk_proven");
  assert.equal(classifyDatasetStatus({
    id: "x",
    status: "ready",
    deploymentStatus: "ready",
    profile: { diskInventoryProven: true, volumeInventoryRunId: "run-audit", volumeInventoryUpdatedAt: "2026-05-07T00:00:00.000Z" },
  }).status, "disk_proven");
  assert.equal(classifyDatasetStatus({
    id: "x",
    status: "ready",
    deploymentStatus: "ready",
    profile: { profile: { quality: { diskInventoryProven: true, volumeInventoryRunId: "run-audit" } } },
  }).status, "disk_proven");
});

test("prompt record path is deterministic and filesystem-safe", () => {
  assert.equal(
    promptRecordPath("medieval-studies", "2026-05-07T12:34:56.789Z", "create"),
    "docs/canonical-runs/medieval-studies/2026-05-07T12-34-56-789Z/create-prompt.md",
  );
});

test("dry-run writes prompt and prints artifact contract without remote start", async () => {
  const root = await mkdtemp(join(tmpdir(), "canonical-dry-run-"));
  try {
    const sourcePath = join(root, "sources.md");
    await writeFile(sourcePath, "- e-codices: https://www.e-codices.unifr.ch/\n", "utf8");
    const output = execFileSync("npx", [
      "tsx",
      "scripts/canonical-dataset.ts",
      "create",
      "--dataset-id",
      "medieval-studies",
      "--name",
      "Medieval Studies",
      "--field-brief",
      "Medieval manuscripts and charters.",
      "--sources",
      sourcePath,
      "--dry-run",
      "--prompt-timestamp",
      "2026-05-07T12:34:56.789Z",
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        RESEARCH_SESSION_PATH: join(root, "missing-session.json"),
      },
    });
    const parsed = JSON.parse(output) as {
      dryRun: boolean;
      promptPath: string;
      artifacts: Array<{ path: string }>;
    };
    assert.equal(parsed.dryRun, true);
    assert.equal(parsed.promptPath, "docs/canonical-runs/medieval-studies/2026-05-07T12-34-56-789Z/create-prompt.md");
    assert.ok(parsed.artifacts.some((artifact) => artifact.path === "volume_inventory.jsonl"));
    const prompt = await readFile(parsed.promptPath, "utf8");
    assert.match(prompt, /Medieval manuscripts and charters/u);
    assert.match(prompt, /volume_inventory\.jsonl/u);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm("docs/canonical-runs/medieval-studies/2026-05-07T12-34-56-789Z", { recursive: true, force: true });
  }
});
