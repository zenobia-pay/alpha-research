import assert from "node:assert/strict";
import test from "node:test";

import { classifyAssistantMessage, summarizeActiveRuns } from "../src/interactive.js";

test("assistant message classifier distinguishes proposal, started, and blocked states", () => {
  assert.equal(
    classifyAssistantMessage("Before I start a remote run, here is the experiment I would use."),
    "proposal",
  );
  assert.equal(
    classifyAssistantMessage("Started query run run-123. Dashboard: https://dashboard.alpharesearch.nyc/..."),
    "started",
  );
  assert.equal(
    classifyAssistantMessage("Blocked: dataset is already busy.\nActive run: run-blocking"),
    "blocked",
  );
  assert.equal(classifyAssistantMessage("Here is what I found."), "default");
});

test("active run summary is separate from the transcript and only includes non-terminal runs", () => {
  const summary = summarizeActiveRuns([
    {
      id: "run-active",
      datasetId: "enriched-tweets",
      origin: "https://alpharesearch.nyc",
      status: "booting",
      prompt: "Analyze tweets",
      createdAt: "2026-05-01T20:00:00.000Z",
      updatedAt: "2026-05-01T20:02:00.000Z",
    },
    {
      id: "run-done",
      datasetId: "econ",
      origin: "https://alpharesearch.nyc",
      status: "completed",
      prompt: "Brief dataset",
      createdAt: "2026-05-01T19:00:00.000Z",
      updatedAt: "2026-05-01T19:30:00.000Z",
      terminalAt: "2026-05-01T19:30:00.000Z",
    },
  ]);

  assert.ok(summary);
  assert.equal(summary?.label, "1 active run");
  assert.deepEqual(summary?.runs.map((run) => run.id), ["run-active"]);
});
