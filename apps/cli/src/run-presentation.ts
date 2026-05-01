import type { TrackedRunRecord } from "./runs.js";

export const STALE_RUN_AFTER_MS = 2 * 60 * 1000;

function sanitizeLine(value: string) {
  return value.replace(/`/g, "").replace(/\s+/g, " ").trim();
}

function firstMeaningfulLine(value: string | undefined) {
  return value
    ?.split("\n")
    .map((line) => sanitizeLine(line))
    .find((line) => line.length > 0)
    ?? null;
}

export function formatAgeFromMs(ageMs: number) {
  if (!Number.isFinite(ageMs) || ageMs < 60_000) {
    return "under 1 minute ago";
  }
  const minutes = Math.round(ageMs / 60_000);
  return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
}

export function describeRunCurrentWork(run: TrackedRunRecord) {
  const latest = firstMeaningfulLine(run.lastEventMessage);
  if (latest) {
    if (/Remote agent droplet .* launched/i.test(latest)) {
      return "Starting the remote worker.";
    }
    return latest;
  }

  const promptLine = firstMeaningfulLine(run.prompt);
  if (!promptLine) {
    return "Preparing the remote job.";
  }
  if (/Mounted dataset grounding is mandatory/i.test(promptLine)) {
    return `Checking that ${run.datasetId} is mounted and readable before analysis starts.`;
  }
  if (/^Describe dataset /i.test(promptLine)) {
    return `Preparing a dataset briefing for ${run.datasetId}.`;
  }
  if (/^Fetch public data:/i.test(promptLine)) {
    return "Collecting the requested source data.";
  }
  return promptLine;
}

export function describeRunState(status: string, isStale: boolean) {
  const normalized = status.toLowerCase();
  if (normalized === "booting") {
    return isStale ? "still starting up and may be stuck" : "starting up";
  }
  if (normalized === "running") {
    return isStale ? "still running but has stopped reporting progress" : "running";
  }
  if (normalized === "queued") {
    return isStale ? "still queued longer than expected" : "queued to start";
  }
  if (normalized === "ready" || normalized === "completed" || normalized === "succeeded") {
    return "completed successfully";
  }
  if (normalized === "failed" || normalized === "error") {
    return "failed";
  }
  if (normalized === "cancelled" || normalized === "canceled") {
    return "cancelled";
  }
  if (normalized === "unknown" || normalized === "worker_unreachable") {
    return "in an uncertain worker state";
  }
  return status;
}

export function describeRunFreshness(run: TrackedRunRecord, now = Date.now()) {
  const updatedAtMs = run.updatedAt ? new Date(run.updatedAt).getTime() : NaN;
  const ageMs = Number.isFinite(updatedAtMs) ? Math.max(0, now - updatedAtMs) : Number.NaN;
  const isStale = Number.isFinite(ageMs) && ageMs >= STALE_RUN_AFTER_MS;
  return {
    ageMs,
    ageLabel: Number.isFinite(ageMs) ? formatAgeFromMs(ageMs) : "unknown",
    isStale,
    statusLabel: isStale ? "stale" : "live",
  };
}

export function describeRunNextAction(run: TrackedRunRecord, isStale: boolean) {
  const normalized = run.status.toLowerCase();
  if (normalized === "booting" && isStale) {
    return "Inspect or debug it now. Waiting is only useful if this dataset usually takes a while to mount.";
  }
  if (normalized === "running" && isStale) {
    return "Inspect recent events now. If nothing changes, debug it or cancel it.";
  }
  if (normalized === "queued") {
    return isStale
      ? "Inspect the queue state now. Cancel only if you no longer need this run."
      : "Waiting is usually safe. Inspect it if the queue should have cleared by now.";
  }
  return isStale
    ? "Inspect it now, then decide whether to keep waiting, debug it, or cancel it."
    : "Waiting is safe for now. Inspect it if you want more detail.";
}

export function buildStuckRunBrief(run: TrackedRunRecord, now = Date.now()) {
  const freshness = describeRunFreshness(run, now);
  return {
    datasetId: run.datasetId,
    runId: run.id,
    stateLabel: describeRunState(run.status, freshness.isStale),
    freshness,
    currentWork: describeRunCurrentWork(run),
    nextAction: describeRunNextAction(run, freshness.isStale),
  };
}
