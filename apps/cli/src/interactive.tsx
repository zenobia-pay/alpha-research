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
import { PROGRESS_HEARTBEAT_MS, RUN_POLL_INTERVAL_MS, type SessionRecord } from "./config.js";
import { RemoteApiClient } from "./remote.js";
import { readTrackedRuns, type TrackedRunRecord, isTerminalRunStatus, updateTrackedRun } from "./runs.js";
import { clearSession, login, readSession } from "./session.js";

type InteractiveAppProps = {
  altScreen?: boolean;
};

export const EMPTY_STATE_EXAMPLE_PROMPTS = [
  "Show the datasets I can use for research",
  "Help me turn a CSV into a dataset I can inspect here",
  "Summarize the latest run and point me to its artifacts",
];

export function emptyStatePromptExamples() {
  return EMPTY_STATE_EXAMPLE_PROMPTS.map((prompt) => `• ${prompt}`);
}

export function runPanelSummary(runs: TrackedRunRecord[]) {
  const activeRuns = runs
    .filter((item) => !item.terminalAt && !isTerminalRunStatus(item.status))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  if (activeRuns.length === 0) {
    return ["No active runs."];
  }
  return activeRuns.map((run) => summarizeRunLine(run));
}

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

function RunStatusPanel({ runs }: { runs: TrackedRunRecord[] }) {
  const activeRuns = useMemo(
    () =>
      runs
        .filter((item) => !item.terminalAt && !isTerminalRunStatus(item.status))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [runs],
  );
  const lines = useMemo(() => (activeRuns.length === 0 ? ["No active runs."] : activeRuns.map((run) => summarizeRunLine(run))), [activeRuns]);

  return (
    <Box flexDirection="column">
      <Text bold color="yellow">Runs</Text>
      {lines.map((line, index) => {
        const run = activeRuns[index];
        const color = run ? runStatusColor(run.status) : "gray";
        return (
          <Text key={`${line}-${index}`} color={color}>
            {`· ${line}`}
          </Text>
        );
      })}
    </Box>
  );
}

function EmptyState() {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="green">research</Text>
      <Text color="gray">Dataset-backed research agent for choosing data, starting work, checking run state, and recovering blocked runs.</Text>
      <Box marginTop={1} flexDirection="column">
        <Text color="yellow">Ready for a prompt.</Text>
        <Text color="gray">Ask about datasets, runs, debugging, or how to build the right dataset for a question.</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text bold color="yellow">Try asking</Text>
        {emptyStatePromptExamples().map((line) => (
          <Text key={line} color="gray">{line}</Text>
        ))}
      </Box>
    </Box>
  );
}

function ResearchThread({ trackedRuns }: { trackedRuns: TrackedRunRecord[] }) {
  const { columns } = useWindowSize();
  const isRunning = useAuiState((state) => state.thread.isRunning);
  const borderColor = isRunning ? "yellow" : "gray";
  const inputWidth = Math.max(20, columns - 4);

  return (
    <ThreadPrimitive.Root>
      <ThreadPrimitive.Empty>
        <EmptyState />
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
      <RunStatusPanel runs={trackedRuns} />

      <Box marginTop={1} flexDirection="column">
        <Text color="gray">Prompt</Text>
        <Box borderStyle="round" borderColor={borderColor} paddingX={1} width={inputWidth}>
          <Text color={isRunning ? "yellow" : "gray"}>{"> "}</Text>
        <ComposerPrimitive.Input submitOnEnter placeholder="ask RESEARCH" autoFocus />
        </Box>
      </Box>
    </ThreadPrimitive.Root>
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
        let heartbeatTimer: NodeJS.Timeout | null = setInterval(() => {
          if (!changed) {
            emit({
              role: "tool",
              content: "Still working. Preparing the next step for this research run...",
            });
          }
        }, PROGRESS_HEARTBEAT_MS);
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
        try {
          await task;
        } finally {
          if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
          }
        }
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
        <ResearchThread trackedRuns={trackedRuns} />
        <RunPoller runtime={runtime} session={session} setTrackedRuns={setTrackedRuns} />
      </Box>
    </AssistantRuntimeProvider>
  );
}
