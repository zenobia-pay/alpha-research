import assert from "node:assert/strict";
import test from "node:test";

import { emptyStatePromptExamples, runPanelSummary } from "../src/interactive.js";
import type { TrackedRunRecord } from "../src/runs.js";

test("empty state prompt examples orient first-time users with concrete next actions", () => {
  const examples = emptyStatePromptExamples();

  assert.equal(examples.length, 3);
  assert.match(examples[0] ?? "", /datasets/i);
  assert.match(examples[1] ?? "", /CSV|dataset/i);
  assert.match(examples[2] ?? "", /latest run|artifacts/i);
});

test("run panel summary shows explicit no-active-runs state", () => {
  assert.deepEqual(runPanelSummary([]), ["No active runs."]);
});

test("run panel summary prioritizes active runs over terminal history", () => {
  const runs = [
    {
      id: "run-completed",
      origin: "https://alpharesearch.nyc",
      datasetId: "econ",
      status: "completed",
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:02:00.000Z",
      lastSeenAt: "2026-05-01T00:02:00.000Z",
      terminalAt: "2026-05-01T00:02:00.000Z",
    },
    {
      id: "run-active",
      origin: "https://alpharesearch.nyc",
      datasetId: "tweets",
      status: "running",
      prompt: "Find viral tweet clusters",
      createdAt: "2026-05-01T00:03:00.000Z",
      updatedAt: "2026-05-01T00:04:00.000Z",
      lastSeenAt: "2026-05-01T00:04:00.000Z",
      lastEventMessage: "Fetched 2 sources",
    },
  ] satisfies TrackedRunRecord[];

  const lines = runPanelSummary(runs);

  assert.equal(lines.length, 1);
  assert.match(lines[0] ?? "", /run-acti/i);
  assert.match(lines[0] ?? "", /tweets/i);
  assert.match(lines[0] ?? "", /running/i);
  assert.match(lines[0] ?? "", /Fetched 2 sources/i);
});

test("run panel summary does not echo raw prompts when no event heartbeat exists", () => {
  const runs = [
    {
      id: "run-active",
      origin: "https://alpharesearch.nyc",
      datasetId: "econ",
      status: "running",
      prompt: "Make me a county-month economics dataset for testing a housing-cycle hypothesis from 2015 to 2025 with many validation requirements.",
      createdAt: "2026-05-01T00:03:00.000Z",
      updatedAt: "2026-05-01T00:04:00.000Z",
      lastSeenAt: "2026-05-01T00:04:00.000Z",
    },
  ] satisfies TrackedRunRecord[];

  const lines = runPanelSummary(runs);

  assert.equal(lines.length, 1);
  assert.match(lines[0] ?? "", /econ/i);
  assert.match(lines[0] ?? "", /running/i);
  assert.doesNotMatch(lines[0] ?? "", /housing-cycle hypothesis/i);
});
