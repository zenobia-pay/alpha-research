import assert from "node:assert/strict";
import test from "node:test";

import { applyAgentMessageToTaskState, beginInteractiveTask, buildLiveSummary, extractAuthRecoveryDetails, extractBlockedRunDetails, splitTrackedRuns, wrapText } from "../src/interactive-state.js";

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

test("orientation prompts start with a compact orientation-specific pending state", () => {
  const state = beginInteractiveTask("What can you help me do?");

  assert.equal(state.currentStep, "Checking the main actions RESEARCH can help with.");
  assert.equal(state.nextExpectedOutput, "A short orientation answer with the best first command to try.");
  assert.deepEqual(state.planSteps, []);
});

test("fully specified run-start prompts begin with run-oriented expectations", () => {
  const state = beginInteractiveTask(
    "Using enriched-tweets, define viral tweets as the top 0.1% by quote_tweet_count. Randomly sample 100 viral tweets, label each for hook_type, emotional_tone, and controversy_level using strict JSON, then produce a bar chart and 10 representative examples.",
  );

  assert.equal(state.currentStep, "Checking whether the named dataset is ready for this run.");
  assert.equal(state.selectedDatasetId, "enriched-tweets");
  assert.match(state.nextExpectedOutput ?? "", /run id and dashboard link|concrete block/i);
  assert.deepEqual(state.planSteps, [
    "Check the named dataset",
    "Verify readiness or explain the block",
    "Start the run or hand off the next action",
  ]);
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
  assert.equal(state.focusRunUrl, "https://dashboard.example/runs/run-symphony-econ-build");
  assert.match(state.nextExpectedOutput ?? "", /artifacts/i);
});

test("dataset readiness blocks are surfaced as first-class blocked state", () => {
  const state = applyAgentMessageToTaskState(beginInteractiveTask("Using enriched-tweets, run the viral tweet analysis."), {
    role: "assistant",
    content: [
      "I accepted the experiment design, but I did not start the run because `enriched-tweets` is uploading.",
      "Dataset: enriched-tweets",
      "State: uploading",
      "Next: wait for the dataset to finish uploading/deploying, then rerun the same prompt.",
    ].join("\n"),
  });

  assert.equal(state.status, "blocked");
  assert.equal(state.statusLabel, "Waiting on dataset readiness");
  assert.equal(state.selectedDatasetId, "enriched-tweets");
  assert.equal(state.selectedDatasetState, "uploading");
  assert.equal(state.currentStep, "Waiting for enriched-tweets to become ready.");
  assert.match(state.nextExpectedOutput ?? "", /wait for the dataset to become ready/i);
});

test("final assistant answers do not get duplicated into recent progress", () => {
  let state = beginInteractiveTask("What can you help me do?");
  state = applyAgentMessageToTaskState(state, {
    role: "tool",
    content: "Checking the main actions RESEARCH can help with.",
  });
  state = applyAgentMessageToTaskState(state, {
    role: "assistant",
    content: "RESEARCH is a command center for agentic research.\n\nSuggestions to get started:\n- `What can i do here?` if you have no clue.",
  });

  assert.deepEqual(state.activity, ["Checking the main actions RESEARCH can help with."]);
  assert.equal(state.status, "done");
  assert.match(buildLiveSummary(state), /Ready for your next question\./i);
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
  assert.equal(state.statusLabel, "Waiting for approval");
  assert.equal(state.currentStep, "Scoping experiment design complete. Waiting for your choice before starting a run.");
  assert.match(state.nextExpectedOutput ?? "", /short user reply/i);
});

test("proposal replies stay visibly distinct from run-started states", () => {
  const state = applyAgentMessageToTaskState(beginInteractiveTask("What types of tweets go viral?"), {
    role: "assistant",
    content: [
      "Before I start a remote run, here is the experiment I recommend.",
      "",
      "Waiting for your approval",
      "Reply with 1, 2, or 3 to start with that metric.",
    ].join("\n"),
  });

  assert.equal(state.status, "waiting");
  assert.equal(state.statusLabel, "Proposal");
  assert.equal(state.focusRunId, null);
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

test("signed-out remote dataset replies become explicit auth recovery state", () => {
  const state = applyAgentMessageToTaskState(beginInteractiveTask("Show my remote datasets."), {
    role: "assistant",
    content: [
      "Sign in to view your remote datasets.",
      "",
      "Next step: run `/login` in this chat or `research login` in another terminal.",
      "After you sign in, ask me again and I’ll pick up: \"Show my remote datasets.\"",
    ].join("\n"),
  });

  assert.equal(state.status, "blocked");
  assert.equal(state.statusLabel, "Sign-in required");
  assert.equal(state.currentStep, "Waiting for you to sign in so I can access remote datasets.");
  assert.match(state.nextExpectedOutput ?? "", /sign in with `\/login`|research login/i);
  assert.deepEqual(extractAuthRecoveryDetails(state.lastResult ?? ""), {
    originalRequest: "Show my remote datasets.",
  });
});

test("single blocking follow-up stays blocked and states that no run has started", () => {
  const state = applyAgentMessageToTaskState(beginInteractiveTask("Use quote_tweet_count and sample 100 tweets."), {
    role: "assistant",
    content: [
      "I can use `quote_tweet_count` and sample 100 tweets. No remote run has started yet.",
      "",
      "Blocked on one setup detail",
      "I need the dataset id before I can launch anything because RESEARCH runs against one mounted dataset at a time. The best current match is `enriched-tweets`.",
      "",
      "Next reply",
      "Reply `use enriched-tweets` to use `enriched-tweets`, or send a different dataset id if you want another source.",
    ].join("\n"),
  });

  assert.equal(state.status, "blocked");
  assert.equal(state.statusLabel, "Blocked");
  assert.match(state.nextExpectedOutput ?? "", /user action to unblock/i);
});

test("busy dataset recovery message becomes a recovery-first blocked state", () => {
  const message = [
    "Blocked: this run is already running on enriched-tweets.",
    "Blocking dataset: enriched-tweets",
    "Blocking run: b00a2860-bf2d-474a-aec2-eaddc4bb704d",
    "Status: booting",
    "Started: May 1, 2026, 4:45 PM PDT (1 minute ago)",
    "Last update: May 1, 2026, 4:45 PM PDT (1 minute ago)",
    "Current work: Label 100 viral tweets and produce a bar chart.",
    "",
    "No new run was started.",
    "Recommended action: wait",
    "Wait first: booting usually clears within a couple of minutes if the worker starts normally.",
    "Escalate if: it stays booting for more than 5 minutes or stops receiving updates.",
    "Inspect now: research debug run b00a2860-bf2d-474a-aec2-eaddc4bb704d",
    "Retry later: rerun this request after b00a2860-bf2d-474a-aec2-eaddc4bb704d finishes or is cancelled.",
  ].join("\n");

  const state = applyAgentMessageToTaskState(beginInteractiveTask("Run a new analysis on enriched-tweets."), {
    role: "assistant",
    content: message,
  });
  const details = extractBlockedRunDetails(message);

  assert.equal(state.status, "blocked");
  assert.equal(state.currentStep, "Recovery needed before enriched-tweets can start a new run.");
  assert.match(state.nextExpectedOutput ?? "", /wait for the blocking run to clear|inspect it if it stays stuck/i);
  assert.equal(details?.runId, "b00a2860-bf2d-474a-aec2-eaddc4bb704d");
  assert.equal(details?.recommendedAction, "wait");
  assert.match(details?.escalationHint ?? "", /more than 5 minutes/i);
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
