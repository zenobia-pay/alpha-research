import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
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
  validateCanonicalImprovementRun,
} from "./canonical-dataset.ts";
import {
  CANONICAL_DATASETS,
  HUMANITIES_DATASET_IDS,
  selectCanonicalDatasets,
} from "./canonical-dataset-catalog.mjs";
import {
  classifyDatasetExpansion,
  hasArtifact as hasDatasetExpansionArtifact,
  renderPrompt as renderDatasetExpansionPrompt,
  summarizeDatasetExpansion,
} from "./dataset-expansion.mjs";

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
    "Do not write these runtime files into the dataset root",
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

test("improve prompt requires focused public-source improvement and hard outputs", async () => {
  const prompt = await renderPrompt("improve", {
    datasetId: "econ",
    datasetName: "Economics",
    fieldBrief: "Economic source package expansion.",
    sourceCatalog: "- fred: https://fred.stlouisfed.org/",
  });
  for (const required of [
    "Improve this canonical dataset now.",
    "Before planning or doing any dataset work, create these non-empty runtime files in the current working directory:",
    "printf '# Work Log\\n\\nStarted canonical improvement run.\\n' > work.md",
    "If no run id or results directory is available, continue anyway.",
    "Do not block only because the run id is unavailable.",
    "The admin validator reads the remote execution artifact list, not just the mounted dataset volume.",
    "copy the exact same bytes back to `./dataset_briefing.md`",
    "Do not send the final response until `ls -l work.md report.html improvement_result.json dataset_briefing.md` succeeds",
    "Add or repair a small, high-value slice of public-source raw data",
    "Preserve source data as close to provider format as practical.",
    "Do not build merged panels, joined analysis tables, model-ready features, or opinionated metrics.",
    "Regenerate final inventories from the dataset volume after the improvement.",
    "Rewrite `dataset_briefing.md` as a literal inventory of data actually on disk.",
    "profile.quality.volumeInventoryRunId",
    "Read the backend profile back and verify it contains the exact briefing and current remote execution id.",
    "improvement_result.json",
    "dataset_briefing.md",
    "docs/public-datasets/briefings/econ.md",
    "docs/public-datasets/econ.mdx",
    "# Data Inventory",
    "Final status is `completed` only if:",
    "Even if blocked, keep `work.md` and `report.html` non-empty, and write `improvement_result.json`",
    "Never print secret values.",
  ]) {
    assert.match(prompt, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  }
  assert.doesNotMatch(prompt, /Do not perform broad source expansion, web search, or new provider downloads/u);
  assert.doesNotMatch(prompt, /only to inspect/u);
  assert.doesNotMatch(prompt, /Remote-Box Briefing Refresh/u);
  assert.doesNotMatch(prompt, /This canonical dataset is a raw public source package/u);
  assert.doesNotMatch(prompt, /Classify each candidate/u);
  assert.doesNotMatch(prompt, /Do not start with filenames/u);
  assert.doesNotMatch(prompt, /Do not include file names/u);
  assert.doesNotMatch(prompt, /For every raw inventory record/u);
  assert.doesNotMatch(prompt, /Do not add a `# Blocked Or Missing Data` section/u);
  assert.doesNotMatch(prompt, /Do not send thin alerts/u);
  assert.doesNotMatch(prompt, /Do not bypass/u);
});

test("improve artifact contract includes runtime work log artifacts", () => {
  const paths = artifactContract("econ", "improve").map((artifact) => artifact.path);
  assert.ok(paths.includes("work.md"), "Improve runs must request the platform work log artifact");
  assert.ok(paths.includes("report.html"), "Improve runs must request the platform report artifact");
  assert.ok(paths.includes("dataset_briefing.md"));
  assert.ok(paths.includes("docs/public-datasets/briefings/econ.md"));
  assert.ok(paths.includes("docs/public-datasets/econ.mdx"));
});

test("improvement validator accepts terminal run with artifacts and matching profile proof", () => {
  const validation = validateCanonicalImprovementRun({
    datasetId: "econ",
    executionId: "exec-123",
    execution: { id: "exec-123", status: "ready" },
    artifacts: [
      { title: "dataset_briefing.md", content: { path: "/results/exec-123/dataset_briefing.md" } },
      { title: "improvement_result.json", content: { path: "/results/exec-123/improvement_result.json" } },
      { title: "work.md", content: { path: "/results/exec-123/work.md" } },
      { title: "report.html", content: { path: "/results/exec-123/report.html" } },
    ],
    dataset: {
      id: "econ",
      status: "ready",
      deploymentStatus: "ready",
      profile: {
        briefingMarkdown: "# Data Inventory\n- Stored data.",
        profile: {
          quality: {
            diskInventoryProven: true,
            volumeInventoryRunId: "exec-123",
            volumeInventoryUpdatedAt: "2026-05-26T21:00:00.000Z",
          },
        },
        describedRunId: "exec-123",
      },
    },
  });
  assert.equal(validation.status, "validated");
  assert.deepEqual(validation.blockers, []);
});

test("improvement validator blocks false completion without briefing artifact", () => {
  const validation = validateCanonicalImprovementRun({
    datasetId: "econ",
    executionId: "exec-123",
    execution: { id: "exec-123", status: "ready" },
    artifacts: [
      { title: "improvement_result.json" },
      { title: "work.md" },
      { title: "report.html" },
    ],
    dataset: {
      id: "econ",
      status: "ready",
      deploymentStatus: "ready",
      profile: {
        briefingMarkdown: "# Data Inventory\n- Stored data.",
        profile: {
          quality: {
            diskInventoryProven: true,
            volumeInventoryRunId: "exec-123",
            volumeInventoryUpdatedAt: "2026-05-26T21:00:00.000Z",
          },
        },
      },
    },
  });
  assert.equal(validation.status, "blocked");
  assert.ok(validation.blockers.includes("remote completed without required artifact: dataset_briefing.md"));
});

test("improvement validator blocks stale profile proof from older run", () => {
  const validation = validateCanonicalImprovementRun({
    datasetId: "econ",
    executionId: "exec-new",
    execution: { id: "exec-new", status: "completed" },
    artifacts: [
      { title: "dataset_briefing.md" },
      { title: "improvement_result.json" },
      { title: "work.md" },
      { title: "report.html" },
    ],
    dataset: {
      id: "econ",
      status: "ready",
      deploymentStatus: "ready",
      profile: {
        briefingMarkdown: "# Data Inventory\n- Stored data.",
        profile: {
          quality: {
            diskInventoryProven: true,
            volumeInventoryRunId: "exec-old",
            volumeInventoryUpdatedAt: "2026-05-26T20:00:00.000Z",
          },
        },
      },
    },
  });
  assert.equal(validation.status, "blocked");
  assert.ok(validation.blockers.includes("profile readback run id exec-old does not match execution exec-new"));
});

test("improvement validator fails safely when admin execution state is unavailable", () => {
  const validation = validateCanonicalImprovementRun({
    datasetId: "econ",
    executionId: "exec-123",
    execution: null,
    artifacts: [],
    dataset: null,
  });
  assert.equal(validation.status, "blocked");
  assert.ok(validation.blockers.includes("remote execution is not terminal: unknown"));
  assert.ok(validation.blockers.includes("dataset readback is not disk_proven: missing_dataset"));
});

test("runtime contract requires Codex login and Slack webhook", () => {
  assert.equal(CANONICAL_RUNTIME_CONTRACT.requiresCodexLogin, true);
  assert.ok(CANONICAL_RUNTIME_CONTRACT.requiredEnvironment.includes("CANONICAL_DATASET_SLACK_WEBHOOK_URL"));
});

test("canonical resource contract targets Modal instead of DigitalOcean runner slugs", () => {
  assert.equal(CANONICAL_PUBLIC_RESOURCES.backend, "modal");
  assert.equal(CANONICAL_PUBLIC_RESOURCES.resourceProfile, "canonical-public");
  assert.equal(CANONICAL_PUBLIC_RESOURCES.storageMode, "modal-volume");
  assert.equal("runnerSize" in CANONICAL_PUBLIC_RESOURCES, false);
});

test("status classifier distinguishes missing, write locks, repairable, unproven, and disk-proven datasets", () => {
  assert.equal(classifyDatasetStatus(null).status, "missing_dataset");
  const lockedRemote = classifyDatasetStatus({
    id: "x",
    status: "ready",
    deploymentStatus: "ready",
    activeRemoteExecutionId: "exec-active",
  });
  assert.equal(lockedRemote.status, "write_locked");
  assert.equal(lockedRemote.improvable, false);
  const lockedLegacy = classifyDatasetStatus({
    id: "x",
    status: "ready",
    deploymentStatus: "ready",
    activeRunId: "run-active",
  });
  assert.equal(lockedLegacy.status, "write_locked");
  assert.equal(lockedLegacy.improvable, false);
  assert.equal(classifyDatasetStatus({ id: "x", status: "failed", deploymentStatus: "failed" }).status, "improvable_needs_repair");
  const staleLegacy = classifyDatasetStatus({ id: "x", status: "deploying", deploymentStatus: "provisioning", profile: {} });
  assert.equal(staleLegacy.status, "improvable_needs_profile_proof");
  assert.equal(staleLegacy.improvable, true);
  assert.deepEqual(staleLegacy.missingOrStale.includes("legacy_status_reconciliation"), true);
  assert.equal(classifyDatasetStatus({ id: "x", status: "ready", deploymentStatus: "ready", profile: {} }).status, "improvable_needs_profile_proof");
  const proven = classifyDatasetStatus({
    id: "x",
    status: "ready",
    deploymentStatus: "ready",
    profile: {
      briefingMarkdown: "Inventory",
      diskInventoryProven: true,
      volumeInventoryRunId: "run-audit",
      volumeInventoryUpdatedAt: "2026-05-07T00:00:00.000Z",
    },
  });
  assert.equal(proven.status, "disk_proven");
  assert.equal(proven.improvable, true);
  assert.equal(proven.queryReady, true);
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
      endpoint: string | null;
      promptPath: string;
      artifacts: Array<{ path: string }>;
    };
    assert.equal(parsed.dryRun, true);
    assert.equal(parsed.endpoint, null);
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
      assert.doesNotMatch(output, /\b(runId|dashboardUrl)\b/u);
      const parsed = JSON.parse(output) as {
        dryRun: boolean;
        results: Array<{
          datasetId?: string;
          status: string;
          endpoint?: string;
          kind?: string;
          operation?: string;
          resources?: { datasetAccess?: string; publishMode?: string; resourceProfile?: string; storageMode?: string };
          artifacts?: string[];
          runtimeArtifacts?: string[];
        }>;
      };
      assert.equal(parsed.dryRun, true);
      assert.deepEqual(
        parsed.results.filter((result) => result.datasetId).map((result) => result.datasetId),
        ["history", "literature"],
      );
      assert.ok(parsed.results.every((result) => result.status !== "missing_dataset"));
      for (const result of parsed.results.filter((entry) => entry.datasetId)) {
        assert.equal(result.resources?.datasetAccess, "write-version", `${args[0]} must request dataset write access`);
        assert.equal(result.resources?.publishMode, "versioned", `${args[0]} must publish a new dataset version`);
        assert.equal(result.resources?.storageMode, "modal-volume", `${args[0]} must target Modal volumes`);
        assert.equal(result.endpoint, "/api/admin/remote-agent-executions", `${args[0]} must launch through admin remote executions`);
        assert.equal(result.kind, "dataset-improvement", `${args[0]} must use the canonical write execution kind`);
      }
      if (args[0] === "scripts/start-canonical-public-dataset-refresh-jobs.mjs") {
        const historyRefresh = parsed.results.find((result) => result.datasetId === "history");
        assert.ok(!historyRefresh?.artifacts?.includes("report.html"));
        assert.ok(historyRefresh?.runtimeArtifacts?.includes("report.html"));
        assert.ok(historyRefresh?.runtimeArtifacts?.includes("work.md"));
      }
    }

    const improveOutput = execFileSync("node", ["scripts/start-canonical-dataset-improvement-jobs.mjs", "--dry-run"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env,
    });
    const improveParsed = JSON.parse(improveOutput) as {
      results: Array<{
        datasetId?: string;
        endpoint?: string;
        kind?: string;
        operation?: string;
        resources?: { datasetAccess?: string; publishMode?: string; resourceProfile?: string; storageMode?: string };
        artifacts?: string[];
      }>;
    };
    assert.doesNotMatch(improveOutput, /\b(runId|dashboardUrl)\b/u);
    const historyImprove = improveParsed.results.find((result) => result.datasetId === "history");
    assert.equal(historyImprove?.endpoint, "/api/admin/remote-agent-executions");
    assert.equal(historyImprove?.kind, "dataset-improvement");
    assert.equal(historyImprove?.operation, "improvement");
    assert.equal(historyImprove?.resources?.datasetAccess, "write-version");
    assert.equal(historyImprove?.resources?.publishMode, "versioned");
    assert.ok(historyImprove?.artifacts?.includes("work.md"));
    assert.ok(historyImprove?.artifacts?.includes("report.html"));
    assert.ok(historyImprove?.artifacts?.includes("docs/public-datasets/briefings/history.md"));
    assert.ok(historyImprove?.artifacts?.includes("docs/public-datasets/history.mdx"));
  } finally {
    execFileSync("rm", ["-rf", root]);
  }
});

test("single dataset improve dry-run targets admin remote Modal execution instead of user-facing runs", async () => {
  const timestamp = "2026-05-14T12:34:56.789Z";
  const output = execFileSync("npx", [
    "tsx",
    "scripts/canonical-dataset.ts",
    "improve",
    "--dataset-id",
    "econ",
    "--field-brief",
    "Refresh the briefing.",
    "--prompt-timestamp",
    timestamp,
    "--dry-run",
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  const parsed = JSON.parse(output) as {
    dryRun: boolean;
    mode: string;
    endpoint: string;
    artifacts: Array<{ path: string }>;
  };
  assert.equal(parsed.dryRun, true);
  assert.equal(parsed.mode, "improve");
  assert.equal(parsed.endpoint, "/api/admin/remote-agent-executions");
  assert.ok(parsed.artifacts.some((artifact) => artifact.path === "work.md"));
  assert.doesNotMatch(output, /\/api\/cli\/datasets\/econ\/runs/u);
  await rm(dirname(promptRecordPath("econ", timestamp, "improve")), { recursive: true, force: true });
});

test("dataset expansion prompt uses explicit dataset and artifact directories", () => {
  const prompt = renderDatasetExpansionPrompt({ datasetId: "econ", datasetName: "Econ" });
  for (const required of [
    "DATASET_DIR=\"${DATASET_DIR:-${DATASET_MOUNT_PATH:-}}\"",
    "ARTIFACT_DIR=\"${ARTIFACT_DIR:-/results/$RUN_ID}\"",
    "Started dataset expansion for econ.",
    "Do not search alternative dataset directories.",
    "For `econ`, prefer broad, authoritative economics data",
    "\"expansionSummary\"",
    "\"actualNewDatasetAdded\"",
    "\"briefingChanges\"",
    "\"slackLifecycleMessages\"",
    "send_slack_lifecycle started \"Dataset expansion run started.\"",
    "send_slack_lifecycle finished",
    "CANONICAL_DATASET_SLACK_WEBHOOK_URL",
    "Completion requires readback to show this run id in the profile proof",
    "ls -l \"$ARTIFACT_DIR/work.md\" \"$ARTIFACT_DIR/report.html\" \"$ARTIFACT_DIR/dataset_briefing.md\" \"$ARTIFACT_DIR/slack_download_alerts.jsonl\" \"$ARTIFACT_DIR/slack_briefing.md\" \"$ARTIFACT_DIR/improvement_result.json\"",
  ]) {
    assert.match(prompt, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  }
  assert.doesNotMatch(prompt, /DATASET_DIR_CANDIDATES|\/data\/datasets|\s\.\/dataset(?:\s|$)/u);
});

test("dataset expansion validator requires artifacts, completed result, and matching profile", () => {
  const artifacts = [
    { title: "work.md", content: { path: "/results/exec-1/work.md", text: "work" } },
    { title: "report.html", content: { path: "/results/exec-1/report.html", text: "<html></html>" } },
    { title: "dataset_briefing.md", content: { path: "/results/exec-1/dataset_briefing.md", text: "# Data Inventory\n- Data." } },
    { title: "slack_download_alerts.jsonl", content: { path: "/results/exec-1/slack_download_alerts.jsonl", text: "{}\n" } },
    { title: "slack_briefing.md", content: { path: "/results/exec-1/slack_briefing.md", text: "# Slack Briefing\n" } },
    {
      title: "improvement_result.json",
      content: {
        path: "/results/exec-1/improvement_result.json",
        text: JSON.stringify({
          status: "completed",
          expansionSummary: {
            actualNewDatasetAdded: "Data",
            pathAdded: "raw/source/data.csv",
            source: "Source",
            coverage: "2026",
            geography: "United States",
            records: "1 row",
            fields: "value",
            caveat: "none",
          },
          briefingChanges: ["- Data."],
          slackLifecycleMessages: [
            { checkpoint: "started", delivery_status: "sent", summary: "Dataset expansion run started." },
            { checkpoint: "finished", delivery_status: "sent", summary: "Data; raw/source/data.csv; 1 row; 2026" },
          ],
        }),
      },
    },
  ];
  assert.equal(hasDatasetExpansionArtifact(artifacts, "dataset_briefing.md"), true);
  const validated = classifyDatasetExpansion({
    executionId: "exec-1",
    execution: { status: "ready" },
    artifacts,
    dataset: { profile: { describedRunId: "exec-1", briefingMarkdown: "# Data Inventory\n- Data." } },
  });
  assert.equal(validated.status, "validated");

  const blocked = classifyDatasetExpansion({
    executionId: "exec-1",
    execution: { status: "ready" },
    artifacts: artifacts.filter((artifact) => artifact.title !== "dataset_briefing.md"),
    dataset: { profile: { describedRunId: "exec-1" } },
  });
  assert.equal(blocked.status, "blocked");
  assert.deepEqual(blocked.missingArtifacts, ["dataset_briefing.md"]);
});

test("dataset expansion summary surfaces added dataset and briefing changes", () => {
  const artifacts = [
    {
      title: "work.md",
      content: {
        path: "/results/exec-1/work.md",
        text: "Staged raw file under `raw/census_bfs/bfs_us_apps_weekly_nsa.csv`.",
      },
    },
    {
      title: "dataset_briefing.md",
      content: {
        path: "/results/exec-1/dataset_briefing.md",
        text: "# Data Inventory\n- raw/census_bfs/bfs_us_apps_weekly_nsa.csv: Census Business Formation Statistics national business applications weekly file. Coverage: 2006-W01 through 2026-W17. Geography: United States national totals. Records: 1,060 weekly observations.",
      },
    },
    {
      title: "improvement_result.json",
      type: "structured_result",
      content: {
        status: "completed",
        runId: "exec-1",
        expansionSummary: {
          actualNewDatasetAdded: "Census Business Formation Statistics weekly national NSA CSV",
          pathAdded: "raw/census_bfs/bfs_us_apps_weekly_nsa.csv",
          source: "U.S. Census Business Formation Statistics",
          coverage: "2006-W01 through 2026-W17",
          geography: "United States national totals",
          records: "1,060 weekly observations",
          fields: "BA_NSA, HBA_NSA, WBA_NSA, CBA_NSA, plus year-over-year percent change columns",
          caveat: "Census says weekly BFS refreshes monthly; this was pulled on 2026-05-28",
        },
        briefingChanges: [
          "- raw/census_bfs/bfs_us_apps_weekly_nsa.csv: Census Business Formation Statistics national business applications weekly file.",
        ],
        slackLifecycleMessages: [
          { checkpoint: "started", delivery_status: "sent", summary: "Dataset expansion run started." },
          { checkpoint: "finished", delivery_status: "sent", summary: "Census Business Formation Statistics weekly national NSA CSV; raw/census_bfs/bfs_us_apps_weekly_nsa.csv; 1,060 weekly observations; 2006-W01 through 2026-W17" },
        ],
      },
    },
  ];
  const summary = summarizeDatasetExpansion({
    artifacts,
    executionId: "exec-1",
    validation: { status: "validated" },
  });
  assert.deepEqual(summary.summaryTable, [
    { item: "run id", value: "exec-1" },
    { item: "status", value: "completed / validated" },
    { item: "actual new dataset added", value: "Census Business Formation Statistics weekly national NSA CSV" },
    { item: "path added", value: "raw/census_bfs/bfs_us_apps_weekly_nsa.csv" },
    { item: "source", value: "U.S. Census Business Formation Statistics" },
    { item: "coverage", value: "2006-W01 through 2026-W17" },
    { item: "geography", value: "United States national totals" },
    { item: "records", value: "1,060 weekly observations" },
    { item: "fields", value: "BA_NSA, HBA_NSA, WBA_NSA, CBA_NSA, plus year-over-year percent change columns" },
    { item: "caveat", value: "Census says weekly BFS refreshes monthly; this was pulled on 2026-05-28" },
  ]);
  assert.ok(summary.briefingChanges.some((change) => change.includes("raw/census_bfs/bfs_us_apps_weekly_nsa.csv")));
});

test("dataset expansion validator blocks missing structured expansion summary", () => {
  const artifacts = [
    { title: "work.md", content: { path: "/results/exec-1/work.md", text: "work" } },
    { title: "report.html", content: { path: "/results/exec-1/report.html", text: "<html></html>" } },
    { title: "dataset_briefing.md", content: { path: "/results/exec-1/dataset_briefing.md", text: "# Data Inventory\n- Data." } },
    { title: "slack_download_alerts.jsonl", content: { path: "/results/exec-1/slack_download_alerts.jsonl", text: "{}\n" } },
    { title: "slack_briefing.md", content: { path: "/results/exec-1/slack_briefing.md", text: "# Slack Briefing\n" } },
    {
      title: "improvement_result.json",
      type: "structured_result",
      content: {
        status: "completed",
        runId: "exec-1",
      },
    },
  ];
  const validation = classifyDatasetExpansion({
    executionId: "exec-1",
    execution: { status: "ready" },
    artifacts,
    dataset: { profile: { describedRunId: "exec-1", briefingMarkdown: "# Data Inventory\n- Data." } },
  });
  assert.equal(validation.status, "blocked");
  assert.ok(validation.blockers.includes("missing expansionSummary"));
  assert.ok(validation.blockers.includes("missing briefingChanges"));
});

test("dataset expansion validator accepts structured result object artifacts", () => {
  const artifacts = [
    { title: "work.md", content: { path: "/results/exec-1/work.md", text: "work" } },
    { title: "report.html", content: { path: "/results/exec-1/report.html", text: "<html></html>" } },
    { title: "dataset_briefing.md", content: { path: "/results/exec-1/dataset_briefing.md", text: "# Data Inventory\n- Data." } },
    { title: "slack_download_alerts.jsonl", content: { path: "/results/exec-1/slack_download_alerts.jsonl", text: "{}\n" } },
    { title: "slack_briefing.md", content: { path: "/results/exec-1/slack_briefing.md", text: "# Slack Briefing\n" } },
    {
      title: "improvement_result.json",
      type: "structured_result",
      content: {
        status: "completed",
        path: "improvement_result.json",
        mimeType: "application/json; charset=utf-8",
        expansionSummary: {
          actualNewDatasetAdded: "Data",
          pathAdded: "raw/source/data.csv",
          source: "Source",
          coverage: "2026",
          geography: "United States",
          records: "1 row",
          fields: "value",
          caveat: "none",
        },
        briefingChanges: ["- Data."],
        slackLifecycleMessages: [
          { checkpoint: "started", delivery_status: "sent", summary: "Dataset expansion run started." },
          { checkpoint: "finished", delivery_status: "sent", summary: "Data; raw/source/data.csv; 1 row; 2026" },
        ],
      },
    },
  ];
  const validation = classifyDatasetExpansion({
    executionId: "exec-1",
    execution: { status: "ready" },
    artifacts,
    dataset: { profile: { describedRunId: "exec-1", briefingMarkdown: "# Data Inventory\n- Data." } },
  });
  assert.equal(validation.status, "validated");
  assert.equal(validation.resultStatus, "completed");
  assert.equal(validation.resultBlocker, null);
});

test("dataset expansion validator surfaces live non-writable mount blocker", () => {
  const artifacts = [
    { title: "work.md", content: { path: "/results/exec-new/work.md", text: "work" } },
    { title: "report.html", content: { path: "/results/exec-new/report.html", text: "<html></html>" } },
    { title: "dataset_briefing.md", content: { path: "/results/exec-new/dataset_briefing.md", text: "# Data Inventory\n- Data." } },
    { title: "slack_download_alerts.jsonl", content: { path: "/results/exec-new/slack_download_alerts.jsonl", text: "{}\n" } },
    { title: "slack_briefing.md", content: { path: "/results/exec-new/slack_briefing.md", text: "# Slack Briefing\n" } },
    {
      title: "improvement_result.json",
      type: "structured_result",
      content: {
        status: "blocked",
        blocker: "dataset_dir_not_writable",
        datasetDir: "/mnt/alpha-research/datasets/econ",
        runId: "exec-new",
        path: "improvement_result.json",
        mimeType: "application/json; charset=utf-8",
      },
    },
  ];
  const validation = classifyDatasetExpansion({
    executionId: "exec-new",
    execution: { status: "ready" },
    artifacts,
    dataset: { profile: { describedRunId: "exec-old", briefingMarkdown: "# Data Inventory\n- Data." } },
  });
  assert.equal(validation.status, "blocked");
  assert.equal(validation.resultStatus, "blocked");
  assert.equal(validation.resultBlocker, "dataset_dir_not_writable");
  assert.ok(validation.blockers.includes("improvement result is blocked: dataset_dir_not_writable"));
  assert.ok(validation.blockers.includes("profile run id exec-old does not match execution exec-new"));
});

test("dataset expansion validator accepts backend profile sync after worker profile API block", () => {
  const artifacts = [
    { title: "work.md", content: { path: "/results/exec-new/work.md", text: "work" } },
    { title: "report.html", content: { path: "/results/exec-new/report.html", text: "<html></html>" } },
    { title: "dataset_briefing.md", content: { path: "/results/exec-new/dataset_briefing.md", text: "# Data Inventory\n- Data." } },
    { title: "slack_download_alerts.jsonl", content: { path: "/results/exec-new/slack_download_alerts.jsonl", text: "{}\n" } },
    { title: "slack_briefing.md", content: { path: "/results/exec-new/slack_briefing.md", text: "# Slack Briefing\n" } },
    {
      title: "improvement_result.json",
      type: "structured_result",
      content: {
        status: "blocked",
        blocker: "dataset_profile_update_unavailable",
        runId: "exec-new",
        path: "improvement_result.json",
      },
    },
  ];
  const validation = classifyDatasetExpansion({
    executionId: "exec-new",
    execution: { status: "ready" },
    artifacts,
    dataset: {
      profile: {
        describedRunId: "exec-new",
        briefingMarkdown: "# Data Inventory\n- Data.",
        profile: { quality: { volumeInventoryRunId: "exec-new", diskInventoryProven: true } },
      },
    },
  });
  assert.equal(validation.status, "validated");
  assert.deepEqual(validation.blockers, []);
});

test("dataset expansion dry-run emits one command contract", () => {
  const root = execFileSync("mktemp", ["-d"], { encoding: "utf8" }).trim();
  const sessionPath = join(root, "session.json");
  writeFileSync(sessionPath, JSON.stringify({ origin: "https://example.invalid", accessToken: "token" }));
  try {
    const output = execFileSync("node", [
      "scripts/dataset-expansion.mjs",
      "--dataset-id",
      "econ",
      "--dry-run",
      "--prompt-timestamp",
      "2026-05-27T18:00:00.000Z",
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        RESEARCH_SESSION_PATH: sessionPath,
      },
    });
    const parsed = JSON.parse(output) as {
      dryRun: boolean;
      endpoint: string;
      kind: string;
      artifactSpec: Array<{ path: string }>;
      execution?: { provider?: string; codexArgs?: string[] };
      resources: { datasetAccess?: string; storageMode?: string };
      metadata: { canonicalJobKind?: string; jobKind?: string; operation?: string; canonicalMaintenanceMode?: string; requiresWritableDatasetDir?: boolean; datasetDir?: string; datasetDirFallbacks?: string[] };
    };
    assert.equal(parsed.dryRun, true);
    assert.equal(parsed.endpoint, "/api/admin/remote-agent-executions");
    assert.equal(parsed.kind, "dataset-improvement");
    assert.equal(parsed.execution?.provider, "modal");
    assert.ok(parsed.execution?.codexArgs?.includes("--dangerously-bypass-approvals-and-sandbox"));
    assert.equal(parsed.resources.datasetAccess, "write-version");
    assert.equal(parsed.resources.storageMode, "modal-volume");
    assert.equal(parsed.metadata.datasetDir, "/mnt/alpha-research/datasets/econ");
    assert.equal(parsed.metadata.datasetDirFallbacks, undefined);
    assert.equal(parsed.metadata.canonicalJobKind, "dataset-improvement");
    assert.equal(parsed.metadata.jobKind, "dataset-improvement");
    assert.equal(parsed.metadata.operation, "dataset-expansion");
    assert.equal(parsed.metadata.canonicalMaintenanceMode, "dataset-expansion");
    assert.equal(parsed.metadata.requiresWritableDatasetDir, true);
    assert.deepEqual(parsed.artifactSpec.map((artifact) => artifact.path), [
      "work.md",
      "report.html",
      "dataset_briefing.md",
      "slack_download_alerts.jsonl",
      "slack_briefing.md",
      "improvement_result.json",
    ]);
  } finally {
    execFileSync("rm", ["-rf", root]);
    execFileSync("rm", ["-rf", "docs/canonical-runs/econ/2026-05-27T18-00-00-000Z"], { cwd: process.cwd() });
  }
});

test("bulk improve builds direct admin remote execution payload", async () => {
  const module = await import("./start-canonical-dataset-improvement-jobs.mjs");
  const body = module.remoteAgentImprovementBody({
    dataset: { id: "econ", name: "Econ" },
    prompt: "Refresh econ.",
    artifacts: [{ type: "file", title: "Dataset Briefing", path: "dataset_briefing.md" }],
    requiredArtifacts: ["dataset_briefing.md"],
    write: { improvable: true },
  });
  assert.equal(body.datasetId, "econ");
  assert.equal(body.kind, "dataset-improvement");
  assert.equal(body.ownerType, "admin");
  assert.equal(body.metadata.launchedBy, "scripts/start-canonical-dataset-improvement-jobs.mjs");
  assert.equal(body.metadata.jobKind, "dataset-improvement");
  assert.deepEqual(body.requiredArtifacts, ["dataset_briefing.md"]);
  assert.equal(body.artifactSpec[0].path, "dataset_briefing.md");
});

test("single dataset add script builds platform-owned bootstrap request", () => {
  const output = execFileSync("node", [
    "scripts/add-canonical-dataset.mjs",
    "--name",
    "History",
    "--prompt",
    "Start with public archives, newspapers, and government records.",
    "--dry-run",
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      CANONICAL_DATASET_IDS: "",
      RESEARCH_SESSION_PATH: join(tmpdir(), "missing-session.json"),
    },
  });
  const parsed = JSON.parse(output) as {
    dryRun: boolean;
    endpoint: string;
    body: {
      datasetId: string;
      name: string;
      owner: string;
      resources: { datasetAccess?: string; publishMode?: string; resourceProfile?: string };
      execution: {
        remoteAgentExecutionOwner: string;
        userSessionRequired: boolean;
        codexMode: string;
        codexArgs: string[];
        promptEnvelope: { type: string; command: string; promptField: string };
      };
      prompt: string;
      requiredEnvironment: string[];
      requiredArtifacts: string[];
    };
  };
  assert.equal(parsed.dryRun, true);
  assert.equal(parsed.endpoint, "/api/admin/canonical-datasets/bootstrap");
  assert.equal(parsed.body.datasetId, "history");
  assert.equal(parsed.body.name, "History");
  assert.equal(parsed.body.owner, "platform");
  assert.equal(parsed.body.resources.datasetAccess, "write-version");
  assert.equal(parsed.body.resources.publishMode, "versioned");
  assert.equal(parsed.body.resources.resourceProfile, "canonical-public");
  assert.equal(parsed.body.resources.storageMode, "modal-volume");
  assert.equal(parsed.body.execution.remoteAgentExecutionOwner, "service");
  assert.equal(parsed.body.execution.userSessionRequired, false);
  assert.equal(parsed.body.execution.codexMode, "tui");
  assert.deepEqual(parsed.body.execution.codexArgs, ["--dangerously-bypass-approvals-and-sandbox"]);
  assert.deepEqual(parsed.body.execution.promptEnvelope, {
    type: "goal_command",
    command: "/goal",
    promptField: "prompt",
  });
  assert.match(parsed.body.prompt, /Start with public archives/u);
  assert.match(parsed.body.prompt, /Library of Congress/u);
  assert.ok(parsed.body.requiredEnvironment.includes("CANONICAL_DATASET_SLACK_WEBHOOK_URL"));
  assert.ok(parsed.body.requiredArtifacts.includes("dataset_briefing.md"));
});

test("remote agent exec dry-run targets hidden admin execution endpoint with exact prompt", () => {
  const output = execFileSync("node", [
    "scripts/remote-agent-exec.mjs",
    "--prompt",
    "Say exactly hello.",
    "--kind",
    "manual",
    "--dataset-id",
    "literature",
    "--dry-run",
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  const parsed = JSON.parse(output) as {
    dryRun: boolean;
    endpoint: string;
    body: { prompt: string; kind: string; datasetId: string; ownerType: string };
  };
  assert.equal(parsed.dryRun, true);
  assert.equal(parsed.endpoint, "/api/admin/remote-agent-executions");
  assert.equal(parsed.body.prompt, "Say exactly hello.");
  assert.equal(parsed.body.kind, "manual");
  assert.equal(parsed.body.datasetId, "literature");
  assert.equal(parsed.body.ownerType, "admin");
});
