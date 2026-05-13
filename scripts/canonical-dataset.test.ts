import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";

import {
  artifactContract,
  CANONICAL_RUNTIME_CONTRACT,
  CANONICAL_PUBLIC_RESOURCES,
  classifyDatasetStatus,
  loadSourceCatalog,
  parseArgs,
  promptRecordPath,
  registrationBody,
  renderPrompt,
} from "./canonical-dataset.ts";
import {
  CANONICAL_DATASETS,
  HUMANITIES_DATASET_IDS,
  selectCanonicalDatasets,
} from "./canonical-dataset-catalog.mjs";

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

test("humanities catalog defines stable college-major dataset slugs", () => {
  assert.deepEqual(HUMANITIES_DATASET_IDS, [
    "history",
    "literature",
    "philosophy",
    "religion",
    "classics",
    "art-history",
    "musicology",
    "theater-performance",
    "linguistics",
    "anthropology",
  ]);
  const ids = CANONICAL_DATASETS.map((dataset) => dataset.id);
  assert.deepEqual(new Set(ids).size, ids.length);
  for (const id of HUMANITIES_DATASET_IDS) {
    assert.match(id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
    assert.ok(ids.includes(id), `Missing humanities dataset ${id}`);
  }
});

test("canonical catalog entries include names, briefs, and seed sources", () => {
  for (const dataset of CANONICAL_DATASETS) {
    assert.ok(dataset.name.length > 2, `${dataset.id} should have a display name`);
    assert.ok(dataset.fieldBrief.length > 80, `${dataset.id} should have a useful field brief`);
    assert.ok(dataset.seedCandidates.length >= 5, `${dataset.id} should have seed candidates`);
    for (const seed of dataset.seedCandidates) {
      assert.match(seed, /^- .+https?:\/\/.+ \((active_fetchable|deferred_fetchable|license_review|credential_required|reject)\)$/u);
    }
  }
});

test("canonical dataset filtering selects the same shared catalog subset", () => {
  assert.deepEqual(
    selectCanonicalDatasets("history,literature").map((dataset) => dataset.id),
    ["history", "literature"],
  );
  assert.throws(() => selectCanonicalDatasets("history,unknown-humanities"), /Unknown canonical dataset id/u);
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
    "Execute the work now",
    "Do not stop after writing a plan",
    "legacy remote-worker environment endpoint",
    "Do not write `report.html` into the dataset root",
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
    "one concrete dataset/API response/document collection in plain English",
    "Do not include file names or blocked / missing data, or metadata in the briefing. Just include exactly what data is stored.",
    "POST /api/cli/datasets/medieval-studies/profile",
    "read back `GET /api/cli/datasets/medieval-studies`",
    "update_remote_dataset_profile",
    "copy `dataset_briefing.md`",
    ".remote-agent/workspaces/<run-id>/artifacts/",
    "Do not delete active runtime directories during the run",
    "authenticated Codex CLI/session",
    "/mnt/alpha-research/datasets/medieval-studies",
    "If the dataset root path does not exist yet, stop and report that the platform bootstrap has not mounted the canonical dataset volume.",
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
  assert.ok(!paths.includes("report.html"), "Create/build artifact contract must not require runtime report.html");
});

test("dataset create registers catalog entry without starting a public-environment run", () => {
  const body = registrationBody({
    datasetId: "history",
    datasetName: "History",
    fieldBrief: "Historical public source package.",
  });
  assert.deepEqual(body.datasetId, "history");
  assert.deepEqual(body.sourceType, "public_data");
  assert.deepEqual(body.mode, "unstructured");
  assert.match(body.description, /Employee-side registration only/u);
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
    "Execute the work now",
    "Do not stop after writing a plan",
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
    "one concrete dataset/API response/document collection in plain English",
    "Do not include file names or blocked / missing data, or metadata in the briefing. Just include exactly what data is stored.",
    "POST /api/cli/datasets/econ/profile",
    "read back `GET /api/cli/datasets/econ`",
    "update_remote_dataset_profile",
    "copy `dataset_briefing.md`",
    ".remote-agent/workspaces/<run-id>/artifacts/",
    "Do not delete active runtime directories during the run",
    "rewrite or supersede it with an enriched row",
    "Update the CLI-visible dataset profile after the audit",
    "quality.slackAlertsPending",
    "Do not mark Slack as sent unless delivery was actually confirmed",
  ]) {
    assert.match(prompt, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  }
});

test("improve prompt requires remote data-only briefing update", async () => {
  const prompt = await renderPrompt("improve", {
    datasetId: "econ",
    datasetName: "Economics",
    fieldBrief: "Economic source package expansion.",
    sourceCatalog: "- fred: https://fred.stlouisfed.org/",
  });
  for (const required of [
    "Canonical Dataset Remote-Box Briefing Refresh",
    "Execute this focused maintenance pass now inside the remote box.",
    "Use the mounted dataset volume as the dataset root.",
    "Regenerate stale or missing disk inventories from the current mounted volume before writing the briefing.",
    "Write `dataset_briefing.md` at the dataset volume root.",
    "Update the CLI-visible backend dataset profile from the same briefing:",
    "Read back the dataset profile through the backend and verify it contains the exact briefing and current run id.",
    "The briefing answers one question: what data is actually on the mounted dataset volume?",
    "Do not write a provider/package list.",
    "what exact table, API response, or document collection is stored",
    "# Data Inventory",
    "For archives or packaged provider payloads already on disk, describe the extracted data-bearing files or tables.",
    "Write `improvement_result.json` with this shape:",
    "\"profileReadbackVerified\": true",
    "Data comes from FRED",
  ]) {
    assert.match(prompt, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  }
  assert.doesNotMatch(prompt, /This canonical dataset is a raw public source package/u);
  assert.doesNotMatch(prompt, /Do not publish processed tables, merged panels/u);
  assert.doesNotMatch(prompt, /Classify each candidate/u);
  assert.doesNotMatch(prompt, /Fetch active public machine-readable sources/u);
  assert.doesNotMatch(prompt, /slackAlertsSent/u);
  assert.doesNotMatch(prompt, /slackAlertsPending/u);
  assert.doesNotMatch(prompt, /Do not start with filenames/u);
  assert.doesNotMatch(prompt, /Do not include file names/u);
  assert.doesNotMatch(prompt, /For every raw inventory record/u);
  assert.doesNotMatch(prompt, /Do not add a `# Blocked Or Missing Data` section/u);
  assert.doesNotMatch(prompt, /Each Slack message must include/u);
  assert.doesNotMatch(prompt, /Do not send thin alerts/u);
  assert.doesNotMatch(prompt, /Do not bypass/u);
  assert.doesNotMatch(prompt, /Provider-level access failures are not run-level blockers/u);
});

test("runtime contract requires Codex login and Slack webhook", () => {
  assert.equal(CANONICAL_RUNTIME_CONTRACT.requiresCodexLogin, true);
  assert.ok(CANONICAL_RUNTIME_CONTRACT.requiredEnvironment.includes("CANONICAL_DATASET_SLACK_WEBHOOK_URL"));
});

test("canonical resource contract targets Modal instead of DigitalOcean runner slugs", () => {
  assert.equal(CANONICAL_PUBLIC_RESOURCES.backend, "modal");
  assert.equal(CANONICAL_PUBLIC_RESOURCES.resourceProfile, "canonical-public");
  assert.equal("runnerSize" in CANONICAL_PUBLIC_RESOURCES, false);
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

test("orchestration dry-runs use shared catalog filter without a remote session", () => {
  const root = execFileSync("mktemp", ["-d"], { encoding: "utf8" }).trim();
  try {
    const env = {
      ...process.env,
      CANONICAL_DATASET_IDS: "history,literature",
      RESEARCH_SESSION_PATH: join(root, "missing-session.json"),
    };
    const commands = [
      ["node", ["scripts/start-canonical-dataset-improvement-jobs.mjs", "--dry-run"]],
      ["node", ["scripts/start-canonical-dataset-expansion-jobs.mjs", "--dry-run"]],
      ["node", ["scripts/start-canonical-public-dataset-refresh-jobs.mjs", "--dry-run"]],
    ] as const;

    for (const [command, args] of commands) {
      const output = execFileSync(command, args, { cwd: process.cwd(), encoding: "utf8", env });
      const parsed = JSON.parse(output) as {
        dryRun: boolean;
        results: Array<{ datasetId?: string; status: string; artifacts?: string[]; runtimeArtifacts?: string[] }>;
      };
      assert.equal(parsed.dryRun, true);
      assert.deepEqual(
        parsed.results.filter((result) => result.datasetId).map((result) => result.datasetId),
        ["history", "literature"],
      );
      assert.ok(parsed.results.every((result) => result.status !== "missing_dataset"));
      if (args[0] === "scripts/start-canonical-public-dataset-refresh-jobs.mjs") {
        const historyRefresh = parsed.results.find((result) => result.datasetId === "history");
        assert.ok(!historyRefresh?.artifacts?.includes("report.html"));
        assert.ok(historyRefresh?.runtimeArtifacts?.includes("report.html"));
      }
    }

    const improveOutput = execFileSync("node", ["scripts/start-canonical-dataset-improvement-jobs.mjs", "--dry-run"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env,
    });
    const improveParsed = JSON.parse(improveOutput) as {
      results: Array<{ datasetId?: string; artifacts?: string[] }>;
    };
    const historyImprove = improveParsed.results.find((result) => result.datasetId === "history");
    assert.ok(historyImprove?.artifacts?.includes("docs/public-datasets/briefings/history.md"));
    assert.ok(historyImprove?.artifacts?.includes("docs/public-datasets/history.mdx"));
  } finally {
    execFileSync("rm", ["-rf", root]);
  }
});
