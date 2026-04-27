import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { dashboardRunUrl, dashboardTerminalSessionUrl, type SessionRecord } from "./config.js";
import { RemoteApiClient } from "./remote.js";
import { readTrackedRuns } from "./runs.js";
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

export async function buildRunDebugBundle(runId: string) {
  const session = await readSession();
  if (!session) {
    throw new Error("You need to sign in first. Run `research login`.");
  }
  const client = new RemoteApiClient(session);
  const [runPayload, resultsPayload, eventsPayload, artifactsPayload, trackedRuns] = await Promise.all([
    client.getRun(runId).catch((error) => ({ error: error instanceof Error ? error.message : String(error) })),
    client.getRunResults(runId).catch((error) => ({ error: error instanceof Error ? error.message : String(error) })),
    client.getRunEvents(runId).catch((error) => ({ error: error instanceof Error ? error.message : String(error) })),
    client.getRunArtifacts(runId).catch((error) => ({ error: error instanceof Error ? error.message : String(error) })),
    readTrackedRuns(),
  ]);
  const tracked = trackedRuns.find((run) => run.id === runId) ?? null;
  const sessionId = tracked && "sessionId" in tracked ? String((tracked as Record<string, unknown>).sessionId ?? "") : "";
  return {
    generatedAt: new Date().toISOString(),
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
