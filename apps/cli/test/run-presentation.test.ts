import assert from "node:assert/strict";
import test from "node:test";

import { buildStuckRunBrief, describeRunCurrentWork } from "../src/run-presentation.js";
import type { TrackedRunRecord } from "../src/runs.js";

function sampleRun(overrides: Partial<TrackedRunRecord> = {}): TrackedRunRecord {
  return {
    id: "run-1",
    datasetId: "enriched-tweets",
    origin: "https://alpharesearch.nyc",
    status: "booting",
    prompt: "Mounted dataset grounding is mandatory for dataset `enriched-tweets`.\nAnalyze tweets.",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    lastSeenAt: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

test("describeRunCurrentWork translates internal mount prompt", () => {
  const work = describeRunCurrentWork(sampleRun());
  assert.equal(work, "Checking that enriched-tweets is mounted and readable before analysis starts.");
});

test("buildStuckRunBrief marks stale startup clearly", () => {
  const run = sampleRun({
    updatedAt: "2026-05-01T00:00:00.000Z",
  });
  const brief = buildStuckRunBrief(run, new Date("2026-05-01T00:03:00.000Z").getTime());
  assert.equal(brief.freshness.isStale, true);
  assert.match(brief.stateLabel, /may be stuck/i);
  assert.match(brief.nextAction, /inspect or debug/i);
});

test("last event message takes precedence for current work", () => {
  const work = describeRunCurrentWork(sampleRun({
    lastEventMessage: "Remote agent droplet ar-run-enriched-tweets launched in nyc1.",
  }));
  assert.equal(work, "Starting the remote worker.");
});
