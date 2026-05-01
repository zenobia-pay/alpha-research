import assert from "node:assert/strict";
import test from "node:test";

import { deriveBusyDatasetLock, extractBusyDatasetLock } from "../src/interactive-lock.js";
import type { TrackedRunRecord } from "../src/runs.js";

const trackedRun: TrackedRunRecord = {
  id: "8888cc05-c277-4923-a91f-27f5cd4cd0b9",
  datasetId: "enriched-tweets",
  origin: "https://alpharesearch.nyc",
  status: "booting",
  dashboardUrl: "https://dashboard.alpharesearch.nyc/?view=runs&runId=8888cc05-c277-4923-a91f-27f5cd4cd0b9#run-8888cc05-c277-4923-a91f-27f5cd4cd0b9",
  createdAt: "2026-05-01T20:20:00.000Z",
  updatedAt: "2026-05-01T20:20:05.000Z",
  lastSeenAt: "2026-05-01T20:20:05.000Z",
};

test("extractBusyDatasetLock parses dataset lock copy into structured state", () => {
  const lock = extractBusyDatasetLock([
    "Blocked: enriched-tweets is already busy.",
    "No new run was started.",
    "Active run: 8888cc05-c277-4923-a91f-27f5cd4cd0b9",
    "Status: booting",
    "",
    "The existing run still holds the dataset.",
    "Inspect: research debug run 8888cc05-c277-4923-a91f-27f5cd4cd0b9",
  ].join("\n"), [trackedRun]);

  assert.deepEqual(lock, {
    datasetId: "enriched-tweets",
    runId: "8888cc05-c277-4923-a91f-27f5cd4cd0b9",
    status: "booting",
    debugCommand: "research debug run 8888cc05-c277-4923-a91f-27f5cd4cd0b9",
    reason: "The existing run is still starting, so waiting is usually the right next step.",
  });
});

test("deriveBusyDatasetLock falls back to tracked run metadata when dataset is omitted", () => {
  const lock = deriveBusyDatasetLock([
    {
      role: "assistant",
      content: [{
        type: "text",
        text: [
          "Blocked: dataset is already busy.",
          "No new run was started.",
          "Active run: 8888cc05-c277-4923-a91f-27f5cd4cd0b9",
          "Status: booting",
        ].join("\n"),
      }],
    },
  ] as never, [trackedRun]);

  assert.equal(lock?.datasetId, "enriched-tweets");
  assert.equal(lock?.runId, trackedRun.id);
  assert.equal(lock?.status, "booting");
});
