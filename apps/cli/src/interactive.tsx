import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useApp, useInput, useWindowSize } from "ink";
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  ThreadPrimitive,
  useAuiState,
  useLocalRuntime,
  type ChatModelAdapter,
  type ThreadMessage,
} from "@assistant-ui/react-ink";
import { MarkdownText } from "@assistant-ui/react-ink-markdown";

import { type AgentConversationState, type AgentMessage, runAgentTurn } from "./agent.js";
import { RUN_POLL_INTERVAL_MS, type SessionRecord } from "./config.js";
import {
  applyAgentMessageToTaskState,
  beginInteractiveTask,
  buildLiveSummary,
  cleanUiLine,
  createIdleTaskState,
  splitTrackedRuns,
  wrapText,
  type InteractiveTaskState,
} from "./interactive-state.js";
import { RemoteApiClient } from "./remote.js";
import { readTrackedRuns, type TrackedRunRecord, isTerminalRunStatus, updateTrackedRun } from "./runs.js";
import { clearSession, login, readSession } from "./session.js";

type InteractiveAppProps = {
  altScreen?: boolean;
};

function shortId(value: string, size = 8) {
  return value.length > size ? value.slice(0, size) : value;
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

function summarizeRunLine(run: TrackedRunRecord) {
  const latest = run.lastEventMessage?.trim();
  const suffix = latest ? ` · ${latest}` : run.prompt ? ` · ${run.prompt}` : "";
  return `${shortId(run.id)}  ${run.datasetId}  ${run.status}${suffix}`;
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
      {wrapText(text, Math.max(12, width - 4)).map((line, index) => (
        <Text key={index} backgroundColor="black" color="white">
          {`› ${line}`.padEnd(Math.max(12, width - 1), " ")}
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
  const [dots, setDots] = useState(".");

  useEffect(() => {
    if (!isRunning) return undefined;
    const timer = setInterval(() => {
      setDots((current) => (current.length >= 3 ? "." : `${current}.`));
    }, 650);
    return () => clearInterval(timer);
  }, [isRunning]);

  if (!isRunning) return null;

  return (
    <Box>
      <Text color="yellow">{`· working${dots}`}</Text>
    </Box>
  );
}

function TaskSummary({ taskState, width }: { taskState: InteractiveTaskState; width: number }) {
  const composerText = useAuiState((state) => state.composer.text);
  const preview = composerText.trim().length > 0 ? composerText : taskState.goal;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={1}>
      <Text bold color="green">research</Text>
      <Text>{`Status: ${taskState.status}`}</Text>
      {preview ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Goal</Text>
          {wrapText(preview, Math.max(24, width - 6)).map((line, index) => (
            <Text key={index}>{line}</Text>
          ))}
        </Box>
      ) : null}
      {taskState.currentStep ? <Text>{`Current step: ${taskState.currentStep}`}</Text> : null}
      {taskState.lastResult ? <Text>{`Last result: ${taskState.lastResult}`}</Text> : null}
      {taskState.nextExpectedOutput ? <Text>{`Next expected output: ${taskState.nextExpectedOutput}`}</Text> : null}
      {taskState.planSteps.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Plan</Text>
          {taskState.planSteps.map((step, index) => (
            <Text key={step}>{`${index + 1}. ${step}`}</Text>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

function RunStatusPanel({
  runs,
  focusRunId,
}: {
  runs: TrackedRunRecord[];
  focusRunId: string | null;
}) {
  const { focused, background } = useMemo(() => splitTrackedRuns(runs, focusRunId), [focusRunId, runs]);
  if (!focused && background.length === 0) return null;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
      {focused ? (
        <>
          <Text bold>Current run</Text>
          <Text color={runStatusColor(focused.status)}>{summarizeRunLine(focused)}</Text>
        </>
      ) : null}
      {background.length > 0 ? (
        <>
          <Text bold>{focused ? "Background runs" : "Other active runs"}</Text>
          <Text color="gray">These are from earlier work unless a new run is started for this request.</Text>
          {background.slice(0, 2).map((run) => (
            <Text key={run.id} color={runStatusColor(run.status)}>
              {summarizeRunLine(run)}
            </Text>
          ))}
        </>
      ) : null}
    </Box>
  );
}

function ResearchThread({
  trackedRuns,
  taskState,
}: {
  trackedRuns: TrackedRunRecord[];
  taskState: InteractiveTaskState;
}) {
  const { columns } = useWindowSize();
  const isRunning = useAuiState((state) => state.thread.isRunning);
  const borderColor = isRunning ? "yellow" : "gray";
  const inputWidth = Math.max(20, columns - 4);

  return (
    <ThreadPrimitive.Root>
      <ThreadPrimitive.Empty>
        <Box flexDirection="column">
          <TaskSummary taskState={taskState} width={columns} />
        </Box>
      </ThreadPrimitive.Empty>

      <TaskSummary taskState={taskState} width={columns} />

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
      {taskState.activity.length > 0 ? (
        <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1}>
          <Text bold>Recent progress</Text>
          {taskState.activity.map((item) => (
            <Text key={item}>{`· ${item}`}</Text>
          ))}
        </Box>
      ) : null}
      <RunStatusPanel runs={trackedRuns} focusRunId={taskState.focusRunId} />

      <Box borderStyle="round" borderColor={borderColor} paddingX={1} width={inputWidth}>
        <Text color={isRunning ? "yellow" : "gray"}>{"> "}</Text>
        <ComposerPrimitive.Input submitOnEnter placeholder="ask RESEARCH" autoFocus />
      </Box>
    </ThreadPrimitive.Root>
  );
}

function RunPoller({
  session,
  setTrackedRuns,
}: {
  session: SessionRecord | null;
  setTrackedRuns: (runs: TrackedRunRecord[]) => void;
}) {
  useEffect(() => {
    if (!session) {
      return undefined;
    }

    let cancelled = false;
    const emit = (_message: AgentMessage) => {};

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
  }, [session, setTrackedRuns]);

  return null;
}

function createResearchAdapter({
  exit,
  sessionRef,
  setSession,
  conversationStateRef,
  setConversationState,
  setTrackedRuns,
  setTaskState,
}: {
  exit: () => void;
  sessionRef: React.MutableRefObject<SessionRecord | null>;
  setSession: (session: SessionRecord | null) => void;
  conversationStateRef: React.MutableRefObject<AgentConversationState>;
  setConversationState: (state: AgentConversationState) => void;
  setTrackedRuns: (runs: TrackedRunRecord[]) => void;
  setTaskState: (state: InteractiveTaskState | ((current: InteractiveTaskState) => InteractiveTaskState)) => void;
}): ChatModelAdapter {
  return {
    async *run({ messages, abortSignal }) {
      const prompt = textFromThreadMessage(messages.filter((message) => message.role === "user").at(-1));
      let liveTaskState = createIdleTaskState();
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
        liveTaskState = applyAgentMessageToTaskState(liveTaskState, message);
        setTaskState(liveTaskState);
        if (message.role === "assistant") {
          visibleText = cleanUiLine(message.content);
        } else {
          visibleText = buildLiveSummary(liveTaskState);
        }
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
        setTaskState(createIdleTaskState());
        visibleText = "What would you like to do?";
        yield* flush();
        return;
      }

      liveTaskState = beginInteractiveTask(prompt);
      setTaskState(liveTaskState);

      if (prompt === "/quit" || prompt === "/exit") {
        setTaskState(createIdleTaskState());
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
        setTaskState(createIdleTaskState());
        visibleText = "signed out locally";
        yield* flush();
        return;
      }

      if (prompt.startsWith("/cancel")) {
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
          const activeRuns = runs
            .filter((item) => item.origin === session.origin)
            .filter((item) => !item.terminalAt && !isTerminalRunStatus(item.status))
            .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
          const targetRunId = explicitRunId ?? activeRuns[0]?.id;

          if (!targetRunId) {
            setTaskState((current) => ({
              ...current,
              status: "blocked",
              lastResult: "No active tracked run to cancel.",
            }));
            visibleText = "No active tracked run to cancel.";
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
          setTaskState((current) => ({
            ...current,
            status: "done",
            lastResult: `Cancelled run ${targetRunId}.`,
            focusRunId: targetRunId,
          }));
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
            visibleText = liveTaskState.lastResult ?? "done.";
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
  const [taskState, setTaskState] = useState<InteractiveTaskState>(createIdleTaskState());
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
        setTaskState,
      }),
    [exit],
  );
  const runtime = useLocalRuntime(adapter);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Box flexDirection="column">
        <ResearchThread trackedRuns={trackedRuns} taskState={taskState} />
        <RunPoller session={session} setTrackedRuns={setTrackedRuns} />
      </Box>
    </AssistantRuntimeProvider>
  );
}
