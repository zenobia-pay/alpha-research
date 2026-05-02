import assert from "node:assert/strict";
import test from "node:test";

import { applyAgentMessageToTaskState, beginInteractiveTask, buildLiveSummary, splitTrackedRuns, wrapText } from "../src/interactive-state.js";

test("interactive task plan and live summary stay scannable for long dataset builds", () => {
  const state = beginInteractiveTask(
    "Make me a county-month economics dataset for testing a housing-cycle hypothesis from 2015 to 2025. Include FRED rates, Census population/income, Zillow home values and rents, BLS employment/unemployment/CPI, FHFA HPI, and NBER recession indicators. Validate source URLs, row counts, missingness, join keys, temporal coverage, and produce a data dictionary and manifest.",
  );

  assert.deepEqual(state.planSteps, [
    "Discover candidate sources",
    "Validate URLs and coverage",
    "Assemble county-month joins",
    "Check row counts and missingness",
    "Write manifest and data dictionary",
  ]);
  assert.match(buildLiveSummary(state), /Current step: Understanding the request/i);
  assert.match(state.nextExpectedOutput ?? "", /build run|scoped plan/i);
});

test("run command noise is excluded from the visible progress story", () => {
  let state = beginInteractiveTask("build the dataset");
  state = applyAgentMessageToTaskState(state, {
    role: "tool",
    content: "[run 8888] Completed command: /bin/bash -lc 'cat /tmp/file'",
  });
  assert.equal(state.activity.length, 0);

  state = applyAgentMessageToTaskState(state, {
    role: "tool",
    content: "Checking remote datasets...",
  });
  state = applyAgentMessageToTaskState(state, {
    role: "tool",
    content: "Found 7 remote datasets.",
  });

  assert.deepEqual(state.activity, [
    "Checking remote datasets...",
    "Found 7 remote datasets.",
  ]);
  assert.equal(state.currentStep, "Checking remote datasets...");
  assert.equal(state.lastResult, "Found 7 remote datasets.");
});

test("started run summaries become waiting state with a focused run", () => {
  const state = applyAgentMessageToTaskState(beginInteractiveTask("build dataset"), {
    role: "assistant",
    content: "Started research environment build run-symphony-econ-build for econ-housing-cycle. Dashboard: https://dashboard.example/runs/run-symphony-econ-build",
  });

  assert.equal(state.status, "waiting");
  assert.equal(state.focusRunId, "run-symphony-econ-build");
  assert.match(state.nextExpectedOutput ?? "", /artifacts/i);
});

test("clarifying assistant replies keep the task in waiting state", () => {
  const state = applyAgentMessageToTaskState(beginInteractiveTask("Which dataset should I use for housing affordability?"), {
    role: "assistant",
    content: [
      "Best match",
      "- `econ` is the best first dataset for housing affordability.",
      "",
      "Waiting for your answer",
      "- Reply with the geography level you care about most: nationwide, state, metro, county, or tract.",
      "- If you do not care, I will default to nationwide.",
    ].join("\n"),
  });

  assert.equal(state.status, "waiting");
  assert.match(state.nextExpectedOutput ?? "", /short user reply/i);
});

test("file import clarification is treated as waiting for user input", () => {
  const state = applyAgentMessageToTaskState(beginInteractiveTask("I have a CSV of customer support tickets on my desktop. How do I turn it into something I can research here?"), {
    role: "assistant",
    content: [
      "I can help with that, but I need 2 things first:",
      "",
      "- Absolute file path",
      "- One-line description of what is in the file",
      "",
      "Reply with the absolute path and one-line description. No upload is needed.",
    ].join("\n"),
  });

  assert.equal(state.status, "waiting");
  assert.match(state.nextExpectedOutput ?? "", /short user reply/i);
});

test("tracked runs are split into current and background groups", () => {
  const runs = [
    {
      id: "run-current",
      datasetId: "econ",
      origin: "https://alpharesearch.nyc",
      status: "running",
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:05.000Z",
      lastSeenAt: "2026-05-01T00:00:05.000Z",
    },
    {
      id: "run-other",
      datasetId: "enriched-tweets",
      origin: "https://alpharesearch.nyc",
      status: "running",
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:04.000Z",
      lastSeenAt: "2026-05-01T00:00:04.000Z",
    },
  ];

  const { focused, background } = splitTrackedRuns(runs, "run-current");
  assert.equal(focused?.id, "run-current");
  assert.deepEqual(background.map((run) => run.id), ["run-other"]);
});

test("wrapped prompt lines avoid single-character composer style clipping", () => {
  const lines = wrapText("Make me a county month economics dataset for testing a housing cycle hypothesis", 20);
  assert.equal(lines.every((line) => line.length <= 20), true);
  assert.equal(lines.length > 1, true);
});
