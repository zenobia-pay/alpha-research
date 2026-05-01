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
import { RemoteApiClient } from "./remote.js";
import { readTrackedRuns, type TrackedRunRecord, isTerminalRunStatus, updateTrackedRun } from "./runs.js";
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

function clampText(text: string, maxLength: number) {
  const normalized = text.replace(/\s+/gu, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
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
  if (normalized === "booting" || normalized === "starting") return "cyan";
  if (normalized === "running") return "blue";
  if (normalized === "queued") return "magenta";
  return "yellow";
}

export function summarizePrompt(text: string | undefined, maxLength = 160) {
  if (!text) return "No task summary available yet.";
  return clampText(text, maxLength);
}

export function describeRunPhase(status: string | undefined) {
  const normalized = status?.toLowerCase() ?? "unknown";
  switch (normalized) {
    case "queued":
      return { label: "Queued", detail: "Accepted and waiting for the remote worker to pick it up." };
    case "booting":
    case "starting":
      return { label: "Starting", detail: "Accepted and provisioning the remote worker for this run." };
    case "running":
      return { label: "Running", detail: "Worker is active and still processing the request." };
    case "ready":
    case "completed":
    case "succeeded":
      return { label: "Done", detail: "Run finished. Results and artifacts should be available." };
    case "failed":
    case "error":
      return { label: "Error", detail: "Run failed. Inspect the latest event or debug the run." };
    case "cancelled":
    case "canceled":
      return { label: "Cancelled", detail: "Run was stopped before completion." };
    case "unknown":
    case "worker_unreachable":
      return { label: "Blocked", detail: "Remote state is unclear. Inspect the run or retry later." };
    default:
      return { label: "Working", detail: "Run state updated recently. Waiting for the next remote milestone." };
  }
}

export function describeRunExpectation(run: TrackedRunRecord) {
  const prompt = `${run.prompt ?? ""}`.toLowerCase();
  const expectations: string[] = [];
  if (prompt.includes("json")) expectations.push("structured JSON");
  if (prompt.includes("chart")) expectations.push("chart");
  if (prompt.includes("example")) expectations.push("examples");
  if (prompt.includes("label")) expectations.push("labels");
  if (expectations.length === 0) {
    expectations.push("result artifacts");
  }
  return `Expected outputs: ${expectations.join(", ")}.`;
}

export function formatRunLastUpdate(run: TrackedRunRecord) {
  return run.lastEventMessage?.trim()
    ? clampText(run.lastEventMessage, 120)
    : "No remote milestone yet. You can leave this open while the worker continues.";
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

  if (!isRunning) return null;

  return (
    <Box>
      <Text color="yellow">· request accepted · checking datasets and coordinating any active remote runs</Text>
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

  if (activeRuns.length === 0) return null;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color="gray">{`active run${activeRuns.length === 1 ? "" : "s"}`}</Text>
      {activeRuns.map((run) => (
        <Box key={run.id} flexDirection="column" marginBottom={1}>
          <Box>
            <Text color={runStatusColor(run.status)}>{describeRunPhase(run.status).label}</Text>
            <Text>{`  ${shortId(run.id)}  ${run.datasetId}`}</Text>
          </Box>
          <Text color="gray">{describeRunPhase(run.status).detail}</Text>
          <Text>{summarizePrompt(run.prompt, 180)}</Text>
          <Text color="gray">{formatRunLastUpdate(run)}</Text>
          <Text color="gray">{describeRunExpectation(run)}</Text>
          {run.dashboardUrl ? (
            <Text color="gray">{`Next: wait here, or open dashboard ${run.dashboardUrl}`}</Text>
          ) : (
            <Text color="gray">Next: wait here for the next remote milestone.</Text>
          )}
        </Box>
      ))}
    </Box>
  );
}

function ResearchThread({ trackedRuns }: { trackedRuns: TrackedRunRecord[] }) {
  const { columns } = useWindowSize();
  const isRunning = useAuiState((state) => state.thread.isRunning);
  const borderColor = isRunning ? "yellow" : "gray";
  const inputWidth = Math.max(20, columns - 4);
  const composerKey = isRunning ? "busy-composer" : "idle-composer";
  const activeRuns = trackedRuns.filter((item) => !item.terminalAt && !isTerminalRunStatus(item.status));
  const composerPlaceholder = isRunning
    ? "research is working; you can wait, inspect results later, or /cancel"
    : activeRuns.length > 0
    ? "ask RESEARCH or /cancel the latest active run"
    : "ask RESEARCH";

  return (
    <ThreadPrimitive.Root>
      <ThreadPrimitive.Empty>
        <Box flexDirection="column">
          <Text bold color="green">research</Text>
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
      <RunStatusPanel runs={trackedRuns} />

      <Box borderStyle="round" borderColor={borderColor} paddingX={1} width={inputWidth}>
        <Text color={isRunning ? "yellow" : "gray"}>{"> "}</Text>
        <ComposerPrimitive.Input
          key={composerKey}
          submitOnEnter
          placeholder={composerPlaceholder}
          autoFocus={!isRunning}
        />
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
