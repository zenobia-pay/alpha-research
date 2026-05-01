import type { ThreadMessage } from "@assistant-ui/react-ink";

import type { TrackedRunRecord } from "./runs.js";

export type BusyDatasetLockState = {
  datasetId: string;
  runId: string;
  status: string;
  debugCommand: string;
  reason: string;
};

function textFromMessage(message: ThreadMessage | undefined) {
  return message?.content
    .filter((part) => part.type === "text")
    .map((part) => ("text" in part ? part.text : ""))
    .join("")
    .trim() ?? "";
}

function normalizeStatus(status: string) {
  return status.trim().toLowerCase();
}

export function busyDatasetStatusNote(status: string) {
  const normalized = normalizeStatus(status);
  if (normalized === "booting") {
    return "The existing run is still starting, so waiting is usually the right next step.";
  }
  if (normalized === "queued") {
    return "The existing run is queued. No duplicate analysis will start until it clears.";
  }
  if (normalized === "running") {
    return "The existing run is actively working and still holds the dataset.";
  }
  return "The existing run still holds the dataset, so a new analysis cannot start yet.";
}

export function isTrackingMessage(text: string) {
  return /^tracking \d+ existing run/i.test(text.trim());
}

export function extractBusyDatasetLock(
  text: string,
  trackedRuns: TrackedRunRecord[],
): BusyDatasetLockState | null {
  const trimmed = text.trim();
  const datasetMatch = trimmed.match(/^Blocked:\s+([a-z0-9][a-z0-9_-]*)\s+is already busy\./imu);
  const runMatch = trimmed.match(/Active run:\s*([a-z0-9-]+)/imu);
  const statusMatch = trimmed.match(/Status:\s*([a-z_]+)/imu);

  if (!datasetMatch && !runMatch) {
    return null;
  }

  const runId = runMatch?.[1] ?? "";
  const matchedRun = runId ? trackedRuns.find((run) => run.id === runId) : undefined;
  const datasetId = datasetMatch?.[1] === "dataset"
    ? (matchedRun?.datasetId ?? "dataset")
    : (datasetMatch?.[1] ?? matchedRun?.datasetId ?? "dataset");
  const status = statusMatch?.[1] ?? matchedRun?.status ?? "running";

  return {
    datasetId,
    runId: runId || matchedRun?.id || "unknown",
    status,
    debugCommand: runId ? `research debug run ${runId}` : "research debug run <run-id>",
    reason: busyDatasetStatusNote(status),
  };
}

export function deriveBusyDatasetLock(
  messages: readonly ThreadMessage[],
  trackedRuns: TrackedRunRecord[],
): BusyDatasetLockState | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "assistant") {
      continue;
    }
    const blocked = extractBusyDatasetLock(textFromMessage(message), trackedRuns);
    if (blocked) {
      return blocked;
    }
  }
  return null;
}
