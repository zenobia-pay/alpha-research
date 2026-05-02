import assert from "node:assert/strict";
import test from "node:test";

import {
  composerPlaceholder,
  currentWorkSummary,
  describeRunExpectation,
  describeRunPhase,
  formatRunLastUpdate,
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

test("default composer placeholder still serves normal prompts", () => {
  assert.equal(composerPlaceholder(session), "Ask about datasets, runs, or artifacts");
});
