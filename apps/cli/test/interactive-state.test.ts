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
      "Need one detail to finalize",
      "- Start with `econ` (Econ). It is the best current base for housing-affordability research in RESEARCH.",
      "",
      "Questions needed",
      "- Which geography matters most?",
      "- Reply with one choice: `1 nationwide`, `2 state`, `3 metro`, `4 county`, or `5 tract`.",
      "- If you do not care, reply `1` and I will default to nationwide.",
    ].join("\n"),
  });

  assert.equal(state.status, "waiting");
  assert.match(state.nextExpectedOutput ?? "", /short user reply/i);
});

test("approval-waiting progress line keeps the task in waiting state", () => {
  let state = beginInteractiveTask("What types of tweets go viral?");
  state = applyAgentMessageToTaskState(state, {
    role: "assistant",
    content: [
      "Before I start a remote run, here is the experiment I recommend.",
      "",
      "Waiting for your approval",
      "Reply with 1, 2, or 3 to start with that metric.",
    ].join("\n"),
  });
  state = applyAgentMessageToTaskState(state, {
    role: "tool",
    content: "Scoping experiment design complete. Waiting for your choice before starting a run.",
  });

  assert.equal(state.status, "waiting");
  assert.equal(state.currentStep, "Scoping experiment design complete. Waiting for your choice before starting a run.");
  assert.match(state.nextExpectedOutput ?? "", /short user reply/i);
});

test("dataset-selected progress lines keep the user oriented on run kickoff", () => {
  let state = beginInteractiveTask("run the viral tweets experiment");
  state = applyAgentMessageToTaskState(state, {
    role: "tool",
    content: "Dataset selected: enriched-tweets (ready).",
  });
  state = applyAgentMessageToTaskState(state, {
    role: "tool",
    content: "Planning run: sample 100 viral tweets, label strict JSON, build a bar chart, and return 10 examples.",
  });

  assert.equal(state.status, "working");
  assert.equal(state.currentStep, "Planning run: sample 100 viral tweets, label strict JSON, build a bar chart, and return 10 examples.");
  assert.match(state.nextExpectedOutput ?? "", /run kickoff|sampling|labeling/i);
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
      "Send path + one-line description:",
      "",
      "`/absolute/path/to/local-file.csv` + `CSV of customer support tickets`",
      "",
      "Reply with the absolute path to the local file and a one-line description. No upload is needed.",
    ].join("\n"),
  });

  assert.equal(state.status, "waiting");
  assert.match(state.nextExpectedOutput ?? "", /short user reply/i);
});

test("mixed-source intake clarification is treated as blocked on user input", () => {
  const state = applyAgentMessageToTaskState(beginInteractiveTask("I have a private CSV export of support tickets, a public product changelog, and some API docs. What do you need before you build it?"), {
    role: "assistant",
    content: [
      "Blocked on source-of-truth details before I build anything.",
      "",
      "Send these inputs in one reply:",
      "",
      "- Private ticket export: absolute file path to the CSV.",
      "- Public launch history: changelog URL or local file path.",
      "- API source: docs URL and whether the data is public, token-based, or otherwise restricted.",
      "- Approval: say `approved to build` when you want me to start.",
    ].join("\n"),
  });

  assert.equal(state.status, "blocked");
  assert.match(state.nextExpectedOutput ?? "", /user action to unblock|short user reply/i);
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

test("recovery prompts start with a diagnosis-oriented task summary", () => {
  const state = beginInteractiveTask(
    "Something seems blocked or failed. Tell me what is happening, whether anything useful was produced, and what I should do next.",
  );

  assert.equal(state.currentStep, "Checking active work, useful outputs, and the safest next step.");
  assert.equal(state.nextExpectedOutput, "A plain-language diagnosis, any useful outputs, and the best next step.");
  assert.deepEqual(state.planSteps, [
    "Check active work",
    "Look for useful outputs",
    "Separate facts from uncertainty",
    "Recommend the next recovery step",
  ]);
});
