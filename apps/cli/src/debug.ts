import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { dashboardRunUrl, dashboardTerminalSessionUrl, type SessionRecord } from "./config.js";
import { RemoteApiClient } from "./remote.js";
import { isTerminalRunFailureStatus, isTerminalRunSuccessStatus, isUncertainRunStatus, readTrackedRuns } from "./runs.js";
import { readSession } from "./session.js";

function redactSession(session: SessionRecord | null) {
  if (!session) {
    return null;
  }
  return {
    origin: session.origin,
    createdAt: session.createdAt,
    accessTokenPreview: `${session.accessToken.slice(0, 8)}...redacted`,
  };
}

async function readPackageVersion() {
  try {
    const raw = await readFile(new URL("../package.json", import.meta.url), "utf8");
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

export type RunDebugDeps = {
  readSession: typeof readSession;
  createRemoteClient: (session: SessionRecord) => Pick<RemoteApiClient, "getRun" | "getRunResults" | "getRunEvents" | "getRunArtifacts">;
  readTrackedRuns: typeof readTrackedRuns;
  now: () => Date;
};

export function createDefaultRunDebugDeps(): RunDebugDeps {
  return {
    readSession,
    createRemoteClient: (session) => new RemoteApiClient(session),
    readTrackedRuns,
    now: () => new Date(),
  };
}

function runFromPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("run" in payload)) {
    return null;
  }
  const run = (payload as { run?: unknown }).run;
  return run && typeof run === "object" ? run as { status?: string } : null;
}

function lifecycleInterpretation(runPayload: unknown, resultsPayload: unknown) {
  const status = runFromPayload(resultsPayload)?.status ?? runFromPayload(runPayload)?.status;
  if (isTerminalRunSuccessStatus(status)) {
    return {
      classification: "terminal_success",
      message: "The backend reports a successful terminal run.",
    };
  }
  if (isTerminalRunFailureStatus(status)) {
    return {
      classification: "terminal_failure",
      message: "The backend reports an explicit terminal failure. Inspect events, transcript, and artifacts for product or execution failure evidence.",
    };
  }
  if (isUncertainRunStatus(status)) {
    return {
      classification: "terminal_uncertain",
      message: "The backend reports uncertain worker state. This should be reconciled against durable worker status and dataset-volume artifacts before treating it as success or product failure.",
    };
  }
  return {
    classification: status ? "nonterminal_or_unclassified" : "unavailable",
    message: status
      ? "The run is not in a known terminal success, failure, cancellation, or uncertainty state."
      : "No run status was available from the inspected payloads.",
  };
}

export async function buildRunDebugBundle(runId: string, deps: RunDebugDeps = createDefaultRunDebugDeps()) {
  const session = await deps.readSession();
  if (!session) {
    throw new Error("You need to sign in first. Run `research login`.");
  }
  const client = deps.createRemoteClient(session);
  const [runPayload, resultsPayload, eventsPayload, artifactsPayload, trackedRuns] = await Promise.all([
    client.getRun(runId).catch((error) => ({ error: error instanceof Error ? error.message : String(error) })),
    client.getRunResults(runId).catch((error) => ({ error: error instanceof Error ? error.message : String(error) })),
    client.getRunEvents(runId).catch((error) => ({ error: error instanceof Error ? error.message : String(error) })),
    client.getRunArtifacts(runId).catch((error) => ({ error: error instanceof Error ? error.message : String(error) })),
    deps.readTrackedRuns(),
  ]);
  const tracked = trackedRuns.find((run) => run.id === runId) ?? null;
  const sessionId = tracked && "sessionId" in tracked ? String((tracked as Record<string, unknown>).sessionId ?? "") : "";
  return {
    generatedAt: deps.now().toISOString(),
    cli: {
      version: await readPackageVersion(),
      node: process.version,
    },
    session: redactSession(session),
    runId,
    dashboardUrl: dashboardRunUrl(session.origin, runId),
    terminalSessionUrl: sessionId ? dashboardTerminalSessionUrl(session.origin, sessionId, runId) : null,
    trackedRun: tracked,
    remote: {
      run: runPayload,
      results: resultsPayload,
      events: eventsPayload,
      artifacts: artifactsPayload,
    },
    lifecycle: lifecycleInterpretation(runPayload, resultsPayload),
  };
}

export async function runDebugCommand(rest: string[], flags: Record<string, string>) {
  const [kind, runId] = rest;
  if (kind !== "run" || !runId) {
    throw new Error("Usage: research debug run <run-id> [--output <path>]");
  }
  const bundle = await buildRunDebugBundle(runId);
  const output = JSON.stringify(bundle, null, 2);
  if (flags.output) {
    const outputPath = resolve(flags.output);
    await writeFile(outputPath, `${output}\n`, "utf8");
    console.log(`Wrote run debug bundle to ${outputPath}`);
    return;
  }
  console.log(output);
}
