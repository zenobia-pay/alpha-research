import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useApp, useInput, useWindowSize } from "ink";
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  ThreadPrimitive,
  useAuiState,
  useLocalRuntime,
  type AssistantRuntime,
  type ChatModelAdapter,
  type ThreadMessage,
} from "@assistant-ui/react-ink";
import { MarkdownText } from "@assistant-ui/react-ink-markdown";

import { type AgentConversationState, type AgentMessage, runAgentTurn } from "./agent.js";
import { RUN_POLL_INTERVAL_MS, type SessionRecord } from "./config.js";
import { buildRunDebugBundle } from "./debug.js";
import { RemoteApiClient } from "./remote.js";
import { readTrackedRuns, type TrackedRunRecord, isTerminalRunStatus, updateTrackedRun } from "./runs.js";
import { STALE_RUN_AFTER_MS, buildStuckRunBrief } from "./run-presentation.js";
import { clearSession, login, readSession } from "./session.js";

type InteractiveAppProps = {
  altScreen?: boolean;
};

function shortId(value: string, size = 8) {
  return value.length > size ? value.slice(0, size) : value;
}

function fillBar(text: string, width: number) {
  const safeWidth = Math.max(8, width);
  const trimmed = text.length > safeWidth - 4 ? `${text.slice(0, safeWidth - 7)}...` : text;
  return `› ${trimmed}`.padEnd(safeWidth, " ");
}

function textFromThreadMessage(message: ThreadMessage | undefined) {
  return message?.content
    .filter((part) => part.type === "text")
    .map((part) => ("text" in part ? part.text : ""))
    .join("")
    .trim() ?? "";
}

function assistantContent(text: string) {
  return [{ type: "text" as const, text }];
}

function appendAssistant(runtime: AssistantRuntime, text: string) {
  runtime.thread.append({
    role: "assistant",
    content: assistantContent(text),
  });
}

function formatAgentEmission(message: AgentMessage) {
  if (message.role === "tool") {
    return message.content
      .split("\n")
      .map((line) => `· ${line}`)
      .join("\n");
  }
  if (message.role === "system") {
    return message.content
      .split("\n")
      .map((line) => `system · ${line}`)
      .join("\n");
  }
  return message.content;
}

function runStatusColor(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "ready" || normalized === "completed" || normalized === "succeeded") return "green";
  if (normalized === "failed" || normalized === "error") return "red";
  if (normalized === "cancelled" || normalized === "canceled") return "gray";
  if (normalized === "booting") return "yellow";
  if (normalized === "running") return "blue";
  if (normalized === "queued") return "magenta";
  return "yellow";
}

function runCardColor(status: string, isStale: boolean) {
  if (isStale) return "yellow";
  return runStatusColor(status);
}

function activeRunsForSession(runs: TrackedRunRecord[], session: SessionRecord | null) {
  return runs
    .filter((item) => !item.terminalAt && !isTerminalRunStatus(item.status))
    .filter((item) => (session ? item.origin === session.origin : true))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

async function pollTrackedRuns(
  session: SessionRecord,
  emit: (message: AgentMessage) => void,
): Promise<TrackedRunRecord[]> {
  const tracked = (await readTrackedRuns())
    .filter((item) => item.origin === session.origin)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  const active = tracked.filter((item) => !item.terminalAt && !isTerminalRunStatus(item.status));
  if (active.length === 0) {
    return tracked;
  }

  const client = new RemoteApiClient(session);
  const listed = await client.listRuns().catch(() => ({ runs: [] }));
  const listedById = new Map(listed.runs.map((run) => [run.id, run]));

  for (const item of active) {
    const remote = listedById.get(item.id) ?? (await client.getRun(item.id).catch(() => null))?.run;
    if (!remote) {
      continue;
    }

    if (remote.status !== item.status) {
      emit({
        role: isTerminalRunStatus(remote.status) ? "assistant" : "tool",
        content: isTerminalRunStatus(remote.status)
          ? `Run ${item.id} is ${remote.status}.${item.dashboardUrl ? ` Dashboard: ${item.dashboardUrl}` : ""}`
          : `run ${item.id}: ${item.status} -> ${remote.status}`,
      });
    }

    const eventPayload = await client.getRunEvents(item.id, item.lastEventId).catch(() => null);
    let lastEventId = item.lastEventId;
    let lastEventMessage = item.lastEventMessage;
    if (eventPayload?.events?.length) {
      for (const event of eventPayload.events) {
        emit({
          role: "tool",
          content: `[run ${item.id}] ${event.message}`,
        });
      }
      const latestEvent = eventPayload.events[eventPayload.events.length - 1];
      lastEventId = latestEvent?.id ?? lastEventId;
      lastEventMessage = latestEvent?.message ?? lastEventMessage;
    }

    await updateTrackedRun(item.id, (current) => {
      const now = new Date().toISOString();
      return {
        ...current,
        status: remote.status,
        prompt: remote.prompt ?? current.prompt,
        updatedAt: remote.updatedAt ?? now,
        lastSeenAt: now,
        lastEventId,
        lastEventMessage,
        terminalAt: isTerminalRunStatus(remote.status) ? (current.terminalAt ?? now) : undefined,
      };
    });
  }

  return readTrackedRuns();
}

function UserMessage({ width }: { width: number }) {
  const text = useAuiState((state) =>
    state.message.parts
      .filter((part) => part.type === "text")
      .map((part) => ("text" in part ? part.text : ""))
      .join(""),
  );

  return (
    <Box flexDirection="column">
      {text.split("\n").map((line, index) => (
        <Text key={index} backgroundColor="black" color="white">
          {fillBar(line.length > 0 ? line : " ", width)}
        </Text>
      ))}
    </Box>
  );
}

function AssistantMessage() {
  const text = useAuiState((state) =>
    state.message.parts
      .filter((part) => part.type === "text")
      .map((part) => ("text" in part ? part.text : ""))
      .join(""),
  );

  return (
    <Box flexDirection="column">
      <Text bold color="green">research</Text>
      <MarkdownText text={text} />
    </Box>
  );
}

function ActivityIndicator() {
  const isRunning = useAuiState((state) => state.thread.isRunning);
  const frames = ["· thinking", "· thinking.", "· thinking..", "· thinking..."];
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    if (!isRunning) return undefined;
    const timer = setInterval(() => {
      setFrameIndex((current) => (current + 1) % frames.length);
    }, 300);
    return () => clearInterval(timer);
  }, [isRunning]);

  if (!isRunning) return null;

  return (
    <Box>
      <Text color="yellow">{frames[frameIndex]}</Text>
    </Box>
  );
}

function RunStatusPanel({ runs, session }: { runs: TrackedRunRecord[]; session: SessionRecord | null }) {
  const activeRuns = useMemo(() => activeRunsForSession(runs, session), [runs, session]);

  if (activeRuns.length === 0) return null;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold color="yellow">Active run{activeRuns.length === 1 ? "" : "s"}</Text>
      {activeRuns.map((run) => {
        const brief = buildStuckRunBrief(run);
        return (
          <Box key={run.id} flexDirection="column" borderStyle="round" borderColor={runCardColor(run.status, brief.freshness.isStale)} paddingX={1}>
            <Text color={runCardColor(run.status, brief.freshness.isStale)}>
              {`${run.datasetId} ${brief.freshness.isStale ? "· needs attention" : "· in progress"}`}
            </Text>
            <Text>{`State: ${brief.stateLabel}`}</Text>
            <Text>{`Last update: ${brief.freshness.ageLabel} (${brief.freshness.statusLabel}; stale after ${Math.round(STALE_RUN_AFTER_MS / 60000)} minutes)`}</Text>
            <Text>{`Current work: ${brief.currentWork}`}</Text>
            <Text dimColor>{`Actions: /inspect (${shortId(run.id)})  /debug  /wait  /cancel`}</Text>
          </Box>
        );
      })}
    </Box>
  );
}

function ResearchThread({
  trackedRuns,
  session,
  isBooting,
}: {
  trackedRuns: TrackedRunRecord[];
  session: SessionRecord | null;
  isBooting: boolean;
}) {
  const { columns } = useWindowSize();
  const isRunning = useAuiState((state) => state.thread.isRunning);
  const borderColor = isRunning ? "yellow" : "gray";
  const inputWidth = Math.max(20, columns - 4);
  const activeCount = activeRunsForSession(trackedRuns, session).length;

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="green">research</Text>
        <Text dimColor>dataset-backed research agent</Text>
        <Text color={isBooting ? "yellow" : activeCount > 0 ? "yellow" : "gray"}>
          {isBooting
            ? "Loading your workspace..."
            : activeCount > 0
              ? `Watching ${activeCount} active run${activeCount === 1 ? "" : "s"}.`
              : "No active runs. Ask about datasets, runs, or a research plan."}
        </Text>
      </Box>
      <ThreadPrimitive.Root>
      <ThreadPrimitive.Empty>
        <Box flexDirection="column">
          <Text>ready.</Text>
        </Box>
      </ThreadPrimitive.Empty>

      <ThreadPrimitive.Messages>
        {({ message }) =>
          message.role === "user" ? (
            <UserMessage width={Math.max(20, columns - 1)} />
          ) : (
            <AssistantMessage />
          )
        }
      </ThreadPrimitive.Messages>

      <ActivityIndicator />
      <RunStatusPanel runs={trackedRuns} session={session} />

      <Box borderStyle="round" borderColor={borderColor} paddingX={1} width={inputWidth}>
        <Text color={isRunning ? "yellow" : "gray"}>{"> "}</Text>
        <ComposerPrimitive.Input submitOnEnter placeholder="ask RESEARCH" autoFocus />
      </Box>
      </ThreadPrimitive.Root>
    </Box>
  );
}

function RunPoller({
  runtime,
  session,
  setTrackedRuns,
}: {
  runtime: AssistantRuntime;
  session: SessionRecord | null;
  setTrackedRuns: (runs: TrackedRunRecord[]) => void;
}) {
  useEffect(() => {
    if (!session) {
      return undefined;
    }

    let cancelled = false;
    const emit = (message: AgentMessage) => {
      if (!cancelled) {
        appendAssistant(runtime, formatAgentEmission(message));
      }
    };

    const tick = async () => {
      try {
        const runs = await pollTrackedRuns(session, emit);
        if (!cancelled) {
          setTrackedRuns(runs);
        }
      } catch {
        // Keep the TUI stable if remote status polling is temporarily unavailable.
      }
    };

    void tick();
    const timer = setInterval(() => {
      void tick();
    }, RUN_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [runtime, session, setTrackedRuns]);

  return null;
}

function createResearchAdapter({
  exit,
  sessionRef,
  setSession,
  conversationStateRef,
  setConversationState,
  setTrackedRuns,
}: {
  exit: () => void;
  sessionRef: React.MutableRefObject<SessionRecord | null>;
  setSession: (session: SessionRecord | null) => void;
  conversationStateRef: React.MutableRefObject<AgentConversationState>;
  setConversationState: (state: AgentConversationState) => void;
  setTrackedRuns: (runs: TrackedRunRecord[]) => void;
}): ChatModelAdapter {
  return {
    async *run({ messages, abortSignal }) {
      const prompt = textFromThreadMessage(messages.filter((message) => message.role === "user").at(-1));
      let visibleText = "";
      let changed = false;
      let wake: (() => void) | null = null;
      const markChanged = () => {
        changed = true;
        wake?.();
        wake = null;
      };
      const waitForChange = () => new Promise<void>((resolve) => {
        wake = resolve;
      });
      const emit = (message: AgentMessage) => {
        const formatted = formatAgentEmission(message);
        visibleText = visibleText ? `${visibleText}\n${formatted}` : formatted;
        markChanged();
      };
      const flush = function* () {
        yield { content: assistantContent(visibleText || " ") };
      };
      async function* runWithProgress(operation: () => Promise<void>) {
        const task = operation();
        while (true) {
          const result = await Promise.race([
            task.then(() => "done" as const),
            waitForChange().then(() => "changed" as const),
          ]);
          if (changed) {
            changed = false;
            yield { content: assistantContent(visibleText || " ") };
          }
          if (result === "done") {
            break;
          }
          if (abortSignal.aborted) {
            break;
          }
        }
        await task;
      }

      if (!prompt) {
        visibleText = "What would you like to do?";
        yield* flush();
        return;
      }

      if (prompt === "/quit" || prompt === "/exit") {
        visibleText = "exiting.";
        yield* flush();
        setTimeout(exit, 0);
        return;
      }

      if (prompt === "/login") {
        try {
          yield* runWithProgress(async () => {
            const nextSession = await login({}, (message) => {
              emit({ role: "tool", content: message });
            });
            setSession(nextSession);
            sessionRef.current = nextSession;
            const resetState = { sessionId: null, previousResponseId: null };
            conversationStateRef.current = resetState;
            setConversationState(resetState);
            emit({ role: "assistant", content: `signed in to ${nextSession.origin}` });
          });
        } catch (error) {
          visibleText = error instanceof Error ? error.message : String(error);
          yield* flush();
        }
        return;
      }

      if (prompt === "/logout") {
        await clearSession();
        setSession(null);
        sessionRef.current = null;
        const resetState = { sessionId: null, previousResponseId: null };
        conversationStateRef.current = resetState;
        setConversationState(resetState);
        visibleText = "signed out locally";
        yield* flush();
        return;
      }

      if (["/inspect", "/i", "/debug", "/d", "/wait", "/w", "/cancel", "/c"].some((command) => prompt.startsWith(command))) {
        const session = sessionRef.current;
        if (!session) {
          visibleText = "Sign in first with `/login`.";
          yield* flush();
          return;
        }

        try {
          const parts = prompt.split(/\s+/u).filter(Boolean);
          const explicitRunId = parts[1];
          const runs = await readTrackedRuns();
          const activeRuns = activeRunsForSession(runs, session);
          const targetRunId = explicitRunId ?? activeRuns[0]?.id;

          if (!targetRunId) {
            visibleText = "No active tracked run to inspect.";
            yield* flush();
            return;
          }

          if (prompt.startsWith("/inspect") || prompt.startsWith("/i")) {
            const targetRun = activeRuns.find((run) => run.id === targetRunId) ?? runs.find((run) => run.id === targetRunId);
            if (!targetRun) {
              visibleText = `I could not find tracked run ${targetRunId}.`;
              yield* flush();
              return;
            }
            const brief = buildStuckRunBrief(targetRun);
            visibleText = [
              `Watching ${brief.datasetId}.`,
              `State: ${brief.stateLabel}.`,
              `Last update: ${brief.freshness.ageLabel}. Runs are marked stale after ${Math.round(STALE_RUN_AFTER_MS / 60000)} minutes without progress.`,
              `Current work: ${brief.currentWork}`,
              `Next action: ${brief.nextAction}`,
              targetRun.dashboardUrl ? `Run page: ${targetRun.dashboardUrl}` : null,
            ].filter(Boolean).join("\n");
            yield* flush();
            return;
          }

          if (prompt.startsWith("/debug") || prompt.startsWith("/d")) {
            const bundle = await buildRunDebugBundle(targetRunId);
            const trackedRun = bundle.trackedRun;
            const targetRun = trackedRun ?? activeRuns.find((run) => run.id === targetRunId);
            const brief = targetRun ? buildStuckRunBrief(targetRun) : null;
            visibleText = [
              `Debug summary for ${brief?.datasetId ?? targetRunId}.`,
              brief ? `State: ${brief.stateLabel}.` : null,
              brief ? `Last update: ${brief.freshness.ageLabel}.` : null,
              brief ? `Current work: ${brief.currentWork}` : null,
              `Lifecycle check: ${bundle.lifecycle.message}`,
              `Run page: ${bundle.dashboardUrl}`,
            ].filter(Boolean).join("\n");
            yield* flush();
            return;
          }

          if (prompt.startsWith("/wait") || prompt.startsWith("/w")) {
            const rawSeconds = Number(parts[1]);
            const waitSeconds = Number.isFinite(rawSeconds) && rawSeconds > 0 ? Math.min(60, Math.round(rawSeconds)) : 15;
            const deadline = Date.now() + waitSeconds * 1000;
            let latestRuns = runs;
            let latestTarget = activeRuns.find((run) => run.id === targetRunId) ?? runs.find((run) => run.id === targetRunId) ?? null;
            while (Date.now() < deadline) {
              latestRuns = await pollTrackedRuns(session, emit);
              latestTarget = latestRuns.find((run) => run.id === targetRunId) ?? latestTarget;
              if (latestTarget && (latestTarget.terminalAt || isTerminalRunStatus(latestTarget.status))) {
                break;
              }
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
            setTrackedRuns(latestRuns);
            if (!latestTarget) {
              visibleText = `I could not find tracked run ${targetRunId} after waiting.`;
              yield* flush();
              return;
            }
            const brief = buildStuckRunBrief(latestTarget);
            visibleText = latestTarget.terminalAt || isTerminalRunStatus(latestTarget.status)
              ? `Run ${shortId(latestTarget.id)} finished with state ${brief.stateLabel}.`
              : [
                `Still watching ${brief.datasetId}.`,
                `State: ${brief.stateLabel}.`,
                `Last update: ${brief.freshness.ageLabel}.`,
                `Current work: ${brief.currentWork}`,
              ].join("\n");
            yield* flush();
            return;
          }

          const client = new RemoteApiClient(session);
          const payload = await client.cancelRun(targetRunId);
          await updateTrackedRun(targetRunId, (current) => {
            const timestamp = payload.run.updatedAt ?? new Date().toISOString();
            return {
              ...current,
              status: payload.run.status,
              updatedAt: timestamp,
              lastSeenAt: timestamp,
              terminalAt: isTerminalRunStatus(payload.run.status) ? (current.terminalAt ?? timestamp) : current.terminalAt,
            };
          });
          setTrackedRuns(await readTrackedRuns());
          visibleText = `Cancelled run ${targetRunId}.`;
          yield* flush();
        } catch (error) {
          visibleText = error instanceof Error ? error.message : String(error);
          yield* flush();
        }
        return;
      }

      try {
        yield* runWithProgress(async () => {
          const nextSession = await readSession();
          if (nextSession?.accessToken !== sessionRef.current?.accessToken || nextSession?.origin !== sessionRef.current?.origin) {
            setSession(nextSession);
            sessionRef.current = nextSession;
          }

          const nextConversationState = await runAgentTurn(
            prompt,
            nextSession,
            emit,
            conversationStateRef.current,
          );

          if (abortSignal.aborted) {
            return;
          }

          conversationStateRef.current = nextConversationState;
          setConversationState(nextConversationState);
          setTrackedRuns(await readTrackedRuns());
          if (!visibleText) {
            visibleText = "done.";
            markChanged();
          }
        });
      } catch (error) {
        visibleText = error instanceof Error ? error.message : String(error);
        yield* flush();
      }
    },
  };
}

export function InteractiveApp({ altScreen = false }: InteractiveAppProps) {
  const { exit } = useApp();
  const [session, setSessionState] = useState<SessionRecord | null>(null);
  const [trackedRuns, setTrackedRuns] = useState<TrackedRunRecord[]>([]);
  const [isBooting, setIsBooting] = useState(true);
  const [conversationState, setConversationStateState] = useState<AgentConversationState>({
    sessionId: null,
    previousResponseId: null,
  });
  const sessionRef = useRef<SessionRecord | null>(null);
  const conversationStateRef = useRef<AgentConversationState>(conversationState);

  const setSession = (nextSession: SessionRecord | null) => {
    sessionRef.current = nextSession;
    setSessionState(nextSession);
  };

  const setConversationState = (nextState: AgentConversationState) => {
    conversationStateRef.current = nextState;
    setConversationStateState(nextState);
  };

  useInput((value, key) => {
    if (key.escape && !altScreen) {
      exit();
    }
    if (key.ctrl && value === "c") {
      exit();
    }
  });

  useEffect(() => {
    void readSession().then(setSession);
    void readTrackedRuns().then((runs) => {
      setTrackedRuns(runs);
      setIsBooting(false);
    });
  }, []);

  useEffect(() => {
    conversationStateRef.current = conversationState;
  }, [conversationState]);

  const adapter = useMemo(
    () =>
      createResearchAdapter({
        exit,
        sessionRef,
        setSession,
        conversationStateRef,
        setConversationState,
        setTrackedRuns,
      }),
    [exit],
  );
  const runtime = useLocalRuntime(adapter);

  useEffect(() => {
    const active = trackedRuns.filter((item) => !item.terminalAt && !isTerminalRunStatus(item.status));
    if (active.length > 0 && runtime.thread.getState().messages.length === 0) {
      appendAssistant(runtime, `tracking ${active.length} existing run${active.length === 1 ? "" : "s"}.`);
    }
  }, [runtime, trackedRuns]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Box flexDirection="column">
        <ResearchThread trackedRuns={trackedRuns} session={session} isBooting={isBooting} />
        <RunPoller runtime={runtime} session={session} setTrackedRuns={setTrackedRuns} />
      </Box>
    </AssistantRuntimeProvider>
  );
}
