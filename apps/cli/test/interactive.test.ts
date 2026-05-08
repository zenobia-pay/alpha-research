import assert from "node:assert/strict";
import test from "node:test";

import {
  authComposerPlaceholder,
  composerPlaceholder,
  describeRunFreshness,
  currentWorkSummary,
  describeRunExpectation,
  describeRunPhase,
  formatAssistantDisplayText,
  formatRunLastUpdate,
  summarizeCompletedResult,
  summarizePrompt,
} from "../src/interactive.js";
import type { InteractiveTaskState } from "../src/interactive-state.js";
import type { TrackedRunRecord } from "../src/runs.js";

function makeRun(overrides: Partial<TrackedRunRecord> = {}): TrackedRunRecord {
  return {
    id: "run_123456789",
    datasetId: "enriched-tweets",
    origin: "https://alpharesearch.nyc",
    status: "booting",
    prompt: "Using enriched-tweets, label tweets in strict JSON, produce a bar chart, and show 10 representative examples.",
    dashboardUrl: "https://dashboard.alpharesearch.nyc/?view=runs&runId=run_123456789#run-run_123456789",
    createdAt: "2026-05-01T20:00:00.000Z",
    updatedAt: "2026-05-01T20:00:05.000Z",
    lastSeenAt: "2026-05-01T20:00:05.000Z",
    ...overrides,
  };
}

test("describeRunPhase distinguishes starting, running, and blocked states", () => {
  assert.deepEqual(describeRunPhase("booting"), {
    label: "Starting",
    detail: "Accepted and provisioning the remote worker for this run.",
  });
  assert.deepEqual(describeRunPhase("running"), {
    label: "Running",
    detail: "Worker is active and still processing the request.",
  });
  assert.deepEqual(describeRunPhase("worker_unreachable"), {
    label: "Blocked",
    detail: "Remote state is unclear. Inspect the run or retry later.",
  });
});

test("describeRunFreshness classifies fresh, warm, and stale heartbeats", () => {
  assert.deepEqual(
    describeRunFreshness("2026-05-01T20:00:00.000Z", new Date("2026-05-01T20:01:00.000Z").getTime()),
    {
      label: "Fresh",
      color: "green",
      detail: "Healthy if another update arrives within 2 minutes.",
      age: "1m ago",
    },
  );
  assert.deepEqual(
    describeRunFreshness("2026-05-01T20:00:00.000Z", new Date("2026-05-01T20:03:00.000Z").getTime()),
    {
      label: "Warm",
      color: "yellow",
      detail: "Still within the normal wait window. Debug if it stays quiet past 5 minutes.",
      age: "3m ago",
    },
  );
  assert.deepEqual(
    describeRunFreshness("2026-05-01T20:00:00.000Z", new Date("2026-05-01T20:06:00.000Z").getTime()),
    {
      label: "Stale",
      color: "red",
      detail: "Quiet longer than expected. Inspect or debug now.",
      age: "6m ago",
    },
  );
});

test("summarizePrompt preserves readable task context without dumping the full prompt", () => {
  const summary = summarizePrompt(
    "Using enriched-tweets, define viral tweets as the top 0.1% by quote_tweet_count. Randomly sample 100 viral tweets, label each for hook_type, emotional_tone, and controversy_level using strict JSON, then produce a bar chart and 10 representative examples.",
    120,
  );
  assert.match(summary, /Using enriched-tweets, define viral tweets/);
  assert.equal(summary.endsWith("..."), true);
  assert.ok(summary.length <= 120);
});

test("run expectations and last update stay actionable when there is no event history", () => {
  const run = makeRun();
  assert.equal(
    describeRunExpectation(run),
    "Expected outputs: structured JSON, chart, examples, labels.",
  );
  assert.equal(
    formatRunLastUpdate(run),
    "No remote milestone yet. You can leave this open while the worker continues.",
  );
});

test("run last update clamps long event messages", () => {
  const run = makeRun({
    lastEventMessage:
      "Remote agent droplet ar-run-enriched-tweets-926412 launched in nyc1 (s-8vcpu-16gb) and is now downloading dependencies before starting execution.",
  });
  const summary = formatRunLastUpdate(run);
  assert.match(summary, /Remote agent droplet/);
  assert.equal(summary.endsWith("..."), true);
  assert.ok(summary.length <= 120);
});

test("currentWorkSummary surfaces run ids and dashboard links without historical noise", () => {
  const summary = currentWorkSummary({
    goal: "run it",
    status: "waiting",
    statusLabel: "Run started",
    currentStep: "Remote run started and is continuing in the background.",
    lastResult: null,
    nextExpectedOutput: "Run status updates plus artifacts like a manifest, validation report, or briefing.",
    planSteps: [],
    activity: [],
    focusRunId: "run_123456789",
    focusRunUrl: "https://dashboard.alpharesearch.nyc/runs/run_123456789",
    selectedDatasetId: "enriched-tweets",
    selectedDatasetState: "ready",
    startedAt: null,
  } satisfies InteractiveTaskState);

  assert.equal(summary?.title, "Current run");
  assert.deepEqual(summary?.lines.slice(0, 4), [
    "Run id: run_123456789",
    "Dataset: enriched-tweets",
    "Status: waiting · Run started",
    "Dashboard: https://dashboard.alpharesearch.nyc/runs/run_123456789",
  ]);
});

test("currentWorkSummary surfaces blocked dataset readiness before a run exists", () => {
  const summary = currentWorkSummary({
    goal: "run it",
    status: "blocked",
    statusLabel: "Waiting on dataset readiness",
    currentStep: "Waiting for enriched-tweets to become ready.",
    lastResult: null,
    nextExpectedOutput: "Wait for the dataset to become ready, then rerun the same prompt.",
    planSteps: [],
    activity: [],
    focusRunId: null,
    focusRunUrl: null,
    selectedDatasetId: "enriched-tweets",
    selectedDatasetState: "uploading",
    startedAt: null,
  } satisfies InteractiveTaskState);

  assert.equal(summary?.title, "Current work");
  assert.deepEqual(summary?.lines, [
    "Dataset: enriched-tweets (uploading)",
    "State: Waiting for enriched-tweets to become ready.",
    "Next: Wait for the dataset to become ready, then rerun the same prompt.",
  ]);
});

test("currentWorkSummary compresses busy dataset locks into blocking run details", () => {
  const summary = currentWorkSummary({
    goal: "run it",
    status: "blocked",
    statusLabel: "Blocked",
    currentStep: "Recovery needed before enriched-tweets can start a new run.",
    lastResult: [
      "Blocked: this run is already running on enriched-tweets.",
      "Blocking dataset: enriched-tweets",
      "Blocking run: b00a2860-bf2d-474a-aec2-eaddc4bb704d",
      "Status: booting",
      "Expected delay: booting usually clears within a couple of minutes if the worker starts normally.",
      "Escalate if: it stays booting for more than 5 minutes or stops receiving updates.",
    ].join("\n"),
    nextExpectedOutput: "Wait for the blocking run to clear or inspect it if it stays stuck.",
    planSteps: [],
    activity: [],
    focusRunId: "b00a2860-bf2d-474a-aec2-eaddc4bb704d",
    focusRunUrl: "https://dashboard.alpharesearch.nyc/runs/run_123456789",
    selectedDatasetId: "enriched-tweets",
    selectedDatasetState: "booting",
    startedAt: null,
  } satisfies InteractiveTaskState);

  assert.equal(summary?.title, "Blocking run");
  assert.deepEqual(summary?.lines, [
    "Dataset: enriched-tweets",
    "Run id: b00a2860-bf2d-474a-aec2-eaddc4bb704d",
    "Status: booting",
    "Expected delay: booting usually clears within a couple of minutes if the worker starts normally.",
    "Escalate if: it stays booting for more than 5 minutes or stops receiving updates.",
  ]);
});

test("currentWorkSummary turns signed-out remote access into a login recovery card", () => {
  const summary = currentWorkSummary({
    goal: "Show my remote datasets.",
    status: "blocked",
    statusLabel: "Sign-in required",
    currentStep: "Waiting for you to sign in so I can access remote datasets.",
    lastResult: [
      "Sign in to view your remote datasets.",
      "",
      "Next step: run `/login` in this chat or `research login` in another terminal.",
      "After you sign in, ask me again and I’ll pick up: \"Show my remote datasets.\"",
    ].join("\n"),
    nextExpectedOutput: "Sign in with `/login` or `research login`, then retry or resume the original request.",
    planSteps: [],
    activity: [],
    focusRunId: null,
    focusRunUrl: null,
    selectedDatasetId: null,
    selectedDatasetState: null,
    startedAt: null,
  } satisfies InteractiveTaskState);

  assert.equal(summary?.title, "Sign-in recovery");
  assert.deepEqual(summary?.lines, [
    "You are signed out.",
    "Run `/login` here or `research login` in another terminal to continue.",
    "Saved request: Show my remote datasets.",
  ]);
});

test("summarizeCompletedResult extracts a compact retrieval card from the final answer", () => {
  const result = summarizeCompletedResult([
    "Selected the most recent completed run: enriched-tweets, completed May 1, 2026, 1:32 PM PDT (3 minutes ago).",
    "Why this run: Selected your most recent completed run because newer tracked runs are still in progress.",
    "",
    "Summary",
    "- Confirmed the dataset is loaded and summarized the latest findings.",
    "",
    "Artifacts",
    "- Open first: summary.md — written summary you can read first.",
    "- Also available: result.json (structured result data).",
  ].join("\n"));

  assert.deepEqual(result, {
    headline: "Selected completed run: enriched-tweets, completed May 1, 2026, 1:32 PM PDT (3 minutes ago).",
    why: "Selected your most recent completed run because newer tracked runs are still in progress.",
    summary: "Confirmed the dataset is loaded and summarized the latest findings.",
    artifacts: ["summary.md", "result.json"],
  });
});

test("default composer placeholder still serves normal prompts", () => {
  assert.equal(composerPlaceholder({ origin: "https://alpharesearch.nyc", accessToken: "token", createdAt: "2026-05-01T00:00:00.000Z" }), "Ask about datasets, runs, or artifacts");
});

test("auth composer placeholder points directly to login", () => {
  assert.equal(authComposerPlaceholder(), "Type /login to sign in");
});

test("assistant display formatting turns inline pseudo-bullets into readable markdown", () => {
  const formatted = formatAssistantDisplayText(
    "I didn’t catch that. Do you want to: - Create a research environment, or - Run a hypothesis/analysis on an existing dataset? Examples you can send: - “Import /Users/me/data/sales.csv and profile it.” - “Test: captions vs watch time.”",
  );

  assert.match(formatted, /Do you want to:\n\n- Create a research environment,\n- Run a hypothesis\/analysis/u);
  assert.match(formatted, /Examples you can send:\n\n- “Import \/Users\/me\/data\/sales\.csv and profile it\.”\n- “Test: captions vs watch time\.”/u);
});

test("assistant display formatting structures dense dataset summaries", () => {
  const formatted = formatAssistantDisplayText(
    "/mnt/alpha-research/datasets/econ - Size: 23,837 files; ~8.54 GB - Canonical policy: raw provider-native files only (no merged panels) Coverage (key raw sources and paths) - FRED macro: CPI, Fed Funds (raw/fred/.csv) - Census microdata: ACS 2024 (raw/census/acs/csv_pus.zip) - Housing: FHFA HPI (raw/fhfa/hpi_at_.csv) Quality/provenance - Disk inventory proven true; latest expansion run: run-1 - Artifacts on volume: quality_report.md, dataset_briefing.md Limitations/blocks - Blocked/not found from runner: BLS CPI (403/DNS) - License-review: BIS, OECD Want me to: - Generate/refresh the Dataset Briefing doc, - Profile a specific file?",
  );

  assert.match(formatted, /^\/mnt\/alpha-research\/datasets\/econ\n\n\*\*Size:\*\* 23,837 files/u);
  assert.match(formatted, /\*\*Canonical policy:\*\* raw provider-native files only/u);
  assert.match(formatted, /\*\*Coverage\*\*\n- FRED macro: CPI/u);
  assert.match(formatted, /\n- Census microdata: ACS 2024/u);
  assert.match(formatted, /\n\n\*\*Quality\/provenance\*\*\n- Disk inventory proven true/u);
  assert.match(formatted, /\n\n\*\*Limitations\/blocks\*\*\n- Blocked\/not found from runner/u);
  assert.match(formatted, /\n- License-review: BIS, OECD/u);
  assert.match(formatted, /Want me to:\n\n- Generate\/refresh the Dataset Briefing doc,\n- Profile a specific file\?/u);
});
