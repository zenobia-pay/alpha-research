import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

import { RUNS_PATH, RUN_WATCHER_SCRIPT, dashboardRunUrl } from "./config.js";
import { ensureSessionDir } from "./session.js";

export type TrackedRunRecord = {
  id: string;
  datasetId: string;
  origin: string;
  status: string;
  prompt?: string;
  dashboardUrl?: string;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
  lastEventId?: string;
  lastEventMessage?: string;
  terminalAt?: string;
};

const TERMINAL_STATUSES = new Set(["ready", "completed", "failed", "cancelled", "canceled", "error", "succeeded"]);

export function isTerminalRunStatus(status: string | undefined) {
  return status ? TERMINAL_STATUSES.has(status.toLowerCase()) : false;
}

export async function readTrackedRuns(): Promise<TrackedRunRecord[]> {
  try {
    const raw = await readFile(RUNS_PATH, "utf8");
    const parsed = JSON.parse(raw) as TrackedRunRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function writeTrackedRuns(runs: TrackedRunRecord[]) {
  await ensureSessionDir();
  await writeFile(RUNS_PATH, `${JSON.stringify(runs, null, 2)}\n`, "utf8");
}

export async function upsertTrackedRun(run: TrackedRunRecord) {
  const runs = await readTrackedRuns();
  const next = runs.filter((item) => item.id !== run.id);
  next.push(run);
  next.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  await writeTrackedRuns(next);
}

export async function updateTrackedRun(
  runId: string,
  updater: (run: TrackedRunRecord) => TrackedRunRecord,
): Promise<TrackedRunRecord | null> {
  const runs = await readTrackedRuns();
  const index = runs.findIndex((item) => item.id === runId);
  if (index === -1) {
    return null;
  }
  const updated = updater(runs[index]!);
  runs[index] = updated;
  runs.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  await writeTrackedRuns(runs);
  return updated;
}

export async function trackRemoteRun(run: {
  id: string;
  datasetId: string;
  origin: string;
  status: string;
  prompt?: string;
  createdAt?: string;
  updatedAt?: string;
}) {
  const now = new Date().toISOString();
  await upsertTrackedRun({
    id: run.id,
    datasetId: run.datasetId,
    origin: run.origin,
    status: run.status,
    prompt: run.prompt,
    dashboardUrl: dashboardRunUrl(run.origin, run.id),
    createdAt: run.createdAt ?? now,
    updatedAt: run.updatedAt ?? now,
    lastSeenAt: now,
    lastEventMessage: undefined,
    terminalAt: isTerminalRunStatus(run.status) ? now : undefined,
  });
}

export function spawnRunWatcher(runId: string) {
  if (process.env.RESEARCH_DISABLE_RUN_WATCHER === "1") {
    return;
  }
  const child = spawn(process.execPath, [RUN_WATCHER_SCRIPT, "--run-id", runId], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}
