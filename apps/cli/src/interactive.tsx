import React, { useEffect, useMemo, useState } from "react";
import { Box, Static, Text, useApp, useInput, useWindowSize } from "ink";
import TextInput from "ink-text-input";

import { type AgentMessage, runAgentTurn } from "./agent.js";
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

function MessageBlock({ message, width }: { message: AgentMessage; width: number }) {
  const lines = message.content.split("\n");

  if (message.role === "user") {
    return (
      <Box flexDirection="column" marginBottom={1}>
        {lines.map((line, index) => (
          <Text key={`user-${index}`} backgroundColor="gray" color="white">
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

const STATUS_FRAMES = ["", ".", "..", "..."];

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
        role: "tool",
        content: `run ${item.id}: ${item.status} -> ${remote.status}`,
      });
    }

    const eventPayload = await client.getRunEvents(item.id, item.lastEventId).catch(() => null);
    let lastEventId = item.lastEventId;
    if (eventPayload?.events?.length) {
      for (const event of eventPayload.events) {
        emit({
          role: "tool",
          content: `[run ${item.id}] ${event.message}`,
        });
      }
      lastEventId = eventPayload.events[eventPayload.events.length - 1]?.id ?? lastEventId;
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
  const [statusTick, setStatusTick] = useState(0);

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

  useEffect(() => {
    if (status === "idle") {
      setStatusTick(0);
      return;
    }

    const timer = setInterval(() => {
      setStatusTick((current) => current + 1);
    }, 1200);

    return () => {
      clearInterval(timer);
    };
  }, [status]);

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
      appendMessage({ role: "assistant", content: "signed out locally" });
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
      await runAgentTurn(trimmed, nextSession, appendMessage);
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
    const frame = STATUS_FRAMES[statusTick % STATUS_FRAMES.length] ?? "";
    return `${stableStatusText}${frame}`;
  }, [stableStatusText, status, statusTick]);

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

      <Box marginTop={1}>
        <Text color="gray" wrap="truncate-end">
          {busy ? "esc to interrupt" : "? for shortcuts"}
        </Text>
      </Box>
    </Box>
  );
}
