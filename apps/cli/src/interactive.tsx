import React, { useEffect, useMemo, useState } from "react";
import { Box, Static, Text, useApp, useInput, useWindowSize } from "ink";
import TextInput from "ink-text-input";

import { type AgentConversationState, type AgentMessage, runAgentTurn } from "./agent.js";
import { RUN_POLL_INTERVAL_MS, type SessionRecord } from "./config.js";
import { RemoteApiClient } from "./remote.js";
import { readTrackedRuns, type TrackedRunRecord, isTerminalRunStatus, updateTrackedRun } from "./runs.js";
import { clearSession, login, readSession } from "./session.js";

function shortId(value: string, size = 8) {
  return value.length > size ? value.slice(0, size) : value;
}

function fillBar(text: string, width: number) {
  const safeWidth = Math.max(8, width);
  const trimmed = text.length > safeWidth - 4 ? `${text.slice(0, safeWidth - 7)}...` : text;
  return `› ${trimmed}`.padEnd(safeWidth, " ");
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

function MessageBlock({ message, width }: { message: AgentMessage; width: number }) {
  const lines = message.content.split("\n");

  if (message.role === "user") {
    return (
      <Box flexDirection="column" marginBottom={1}>
        {lines.map((line, index) => (
          <Text key={`user-${index}`} backgroundColor="black" color="white">
            {fillBar(line.length > 0 ? line : " ", width)}
          </Text>
        ))}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      {lines.map((line, index) => (
        <Box key={`${message.role}-${index}`}>
          {message.role === "tool" ? (
            <Text color="yellow">{`${index === 0 ? "· " : "  "}${line.length > 0 ? line : " "}`}</Text>
          ) : (
            <Text>{line.length > 0 ? line : " "}</Text>
          )}
        </Box>
      ))}
    </Box>
  );
}

type InteractiveAppProps = {
  altScreen?: boolean;
};

async function pollTrackedRuns(
  session: SessionRecord,
  emit: (message: AgentMessage) => void,
): Promise<TrackedRunRecord[]> {
  const tracked = (await readTrackedRuns())
    .filter((item) => item.origin === session.origin)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  if (tracked.length === 0) {
    return tracked;
  }

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

export function InteractiveApp({ altScreen = false }: InteractiveAppProps) {
  const { exit } = useApp();
  const { columns } = useWindowSize();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      role: "assistant",
      content: "ready.",
    },
  ]);
  const [status, setStatus] = useState<"idle" | "thinking" | "working">("idle");
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [trackedRuns, setTrackedRuns] = useState<TrackedRunRecord[]>([]);
  const [conversationState, setConversationState] = useState<AgentConversationState>({
    sessionId: null,
    previousResponseId: null,
  });

  const appendMessage = (message: AgentMessage) => {
    setMessages((current) => [...current, message]);
  };

  useEffect(() => {
    void readSession().then((nextSession) => {
      setSession(nextSession);
    });
    void readTrackedRuns().then((runs) => {
      setTrackedRuns(runs);
      const active = runs.filter((item) => !item.terminalAt && !isTerminalRunStatus(item.status));
      if (active.length > 0) {
        appendMessage({
          role: "assistant",
          content: `tracking ${active.length} existing run${active.length === 1 ? "" : "s"}.`,
        });
      }
    });
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    let cancelled = false;

    const tick = async () => {
      try {
        const runs = await pollTrackedRuns(session, (message) => {
          if (!cancelled) {
            appendMessage(message);
          }
        });
        if (!cancelled) {
          setTrackedRuns(runs);
        }
      } catch {
        // Keep the UI steady; remote APIs may not be fully available yet.
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
  }, [session]);

  useInput((value, key) => {
    if (key.escape && !altScreen) {
      exit();
    }
    if (key.ctrl && value === "c") {
      exit();
    }
  });

  async function submit() {
    const trimmed = input.trim();
    if (!trimmed || busy) {
      return;
    }

    if (trimmed === "/quit" || trimmed === "/exit") {
      exit();
      return;
    }

    if (trimmed === "/login") {
      setBusy(true);
      setStatus("working");
      appendMessage({ role: "user", content: trimmed });
      setInput("");
      try {
        const nextSession = await login({}, (message) => {
          appendMessage({ role: "tool", content: message });
        });
        setSession(nextSession);
        setConversationState({ sessionId: null, previousResponseId: null });
        appendMessage({ role: "assistant", content: `signed in to ${nextSession.origin}` });
      } catch (error) {
        appendMessage({ role: "assistant", content: error instanceof Error ? error.message : String(error) });
      } finally {
        setBusy(false);
        setStatus("idle");
      }
      return;
    }

    if (trimmed === "/logout") {
      appendMessage({ role: "user", content: trimmed });
      setInput("");
      await clearSession();
      setSession(null);
      setConversationState({ sessionId: null, previousResponseId: null });
      appendMessage({ role: "assistant", content: "signed out locally" });
      return;
    }

    if (trimmed.startsWith("/cancel")) {
      appendMessage({ role: "user", content: trimmed });
      setInput("");
      if (!session) {
        appendMessage({ role: "assistant", content: "Sign in first with `/login`." });
        return;
      }

      const parts = trimmed.split(/\s+/u).filter(Boolean);
      const explicitRunId = parts[1];
      const runs = await readTrackedRuns();
      const activeRuns = runs
        .filter((item) => item.origin === session.origin)
        .filter((item) => !item.terminalAt && !isTerminalRunStatus(item.status))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      const targetRunId = explicitRunId ?? activeRuns[0]?.id;

      if (!targetRunId) {
        appendMessage({ role: "assistant", content: "No active tracked run to cancel." });
        return;
      }

      setBusy(true);
      setStatus("working");
      try {
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
        appendMessage({ role: "assistant", content: `Cancelled run ${targetRunId}.` });
      } catch (error) {
        appendMessage({
          role: "assistant",
          content: error instanceof Error ? error.message : String(error),
        });
      } finally {
        setBusy(false);
        setStatus("idle");
      }
      return;
    }

    appendMessage({ role: "user", content: trimmed });
    setInput("");
    setBusy(true);
    setStatus("thinking");

    try {
      const nextSession = await readSession();
      if (nextSession?.accessToken !== session?.accessToken || nextSession?.origin !== session?.origin) {
        setSession(nextSession);
      }
      setStatus("working");
      const nextConversationState = await runAgentTurn(trimmed, nextSession, appendMessage, conversationState);
      setConversationState(nextConversationState);
      setTrackedRuns(await readTrackedRuns());
    } catch (error) {
      appendMessage({
        role: "assistant",
        content: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(false);
      setStatus("idle");
    }
  }

  const stableStatusText = useMemo(() => {
    if (status === "idle") {
      return "ready";
    }
    return status === "thinking" ? "thinking" : "working";
  }, [status]);

  const activityText = useMemo(() => {
    if (status === "idle") {
      return "ready";
    }
    return stableStatusText;
  }, [stableStatusText, status]);

  const activeRuns = useMemo(
    () =>
      trackedRuns
        .filter((item) => !item.terminalAt && !isTerminalRunStatus(item.status))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [trackedRuns],
  );

  const divider = "─".repeat(Math.max(20, columns - 2));

  return (
    <Box flexDirection="column">
      <Static items={messages}>
        {(message, index) => (
          <MessageBlock key={`${message.role}-${index}`} message={message} width={Math.max(20, columns - 1)} />
        )}
      </Static>

      {status !== "idle" ? (
        <Box marginBottom={1}>
          <Text color={status === "thinking" ? "red" : "yellow"}>
            {`· ${activityText}`}
          </Text>
        </Box>
      ) : null}

      {activeRuns.length > 0 ? (
        <Box flexDirection="column" marginBottom={1}>
          {activeRuns.map((run) => (
            <Text key={run.id} color={runStatusColor(run.status)}>
              {`· [run ${run.id}] ${summarizeRunLine(run)}`}
            </Text>
          ))}
        </Box>
      ) : null}

      <Box>
        <Text color="gray">{divider}</Text>
      </Box>

      <Box>
        <Text color="gray">{"> "}</Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={() => {
            void submit();
          }}
          placeholder=""
        />
      </Box>

      <Box>
        <Text color="gray">{divider}</Text>
      </Box>
    </Box>
  );
}
