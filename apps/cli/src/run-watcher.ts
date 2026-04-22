import { readSession } from "./session.js";
import { RemoteApiClient } from "./remote.js";
import { isTerminalRunStatus, readTrackedRuns, updateTrackedRun } from "./runs.js";

function parseArgs() {
  const args = process.argv.slice(2);
  const index = args.indexOf("--run-id");
  return {
    runId: index >= 0 ? args[index + 1] : undefined,
  };
}

async function main() {
  const { runId } = parseArgs();
  if (!runId) {
    process.exit(1);
  }

  const session = await readSession();
  if (!session) {
    process.exit(0);
  }

  const client = new RemoteApiClient(session);
  let after = (await readTrackedRuns()).find((item) => item.id === runId)?.lastEventId;

  while (true) {
    try {
      const runPayload = await client.getRun(runId).catch(() => null);
      if (runPayload?.run) {
        await updateTrackedRun(runId, (current) => {
          const updatedAt = runPayload.run.updatedAt ?? new Date().toISOString();
          return {
            ...current,
            status: runPayload.run.status,
            prompt: runPayload.run.prompt ?? current.prompt,
            updatedAt,
            lastSeenAt: updatedAt,
            terminalAt: isTerminalRunStatus(runPayload.run.status) ? (current.terminalAt ?? updatedAt) : undefined,
          };
        });
      }

      const eventPayload = await client.getRunEvents(runId, after).catch(() => null);
      if (eventPayload?.events?.length) {
        const lastEvent = eventPayload.events[eventPayload.events.length - 1];
        after = lastEvent?.id ?? after;
        await updateTrackedRun(runId, (current) => ({
          ...current,
          lastEventId: after,
          lastEventMessage: lastEvent?.message ?? current.lastEventMessage,
          lastSeenAt: lastEvent?.createdAt ?? new Date().toISOString(),
        }));
      }

      const latest = (await readTrackedRuns()).find((item) => item.id === runId);
      if (latest && isTerminalRunStatus(latest.status)) {
        break;
      }
    } catch {
      // Keep polling through transient network/auth/control-plane errors.
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

void main().catch(() => {
  process.exit(0);
});
