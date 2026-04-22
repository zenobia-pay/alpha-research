import React, { useEffect, useMemo, useState } from "react";
import { Box, Static, Text, useApp, useInput } from "ink";
import TextInput from "ink-text-input";

import { currentOrigin, runAgentTurn, type AgentMessage } from "./agent.js";
import { DEFAULT_INSTANCE_ROOT, RUN_POLL_INTERVAL_MS, type SessionRecord } from "./config.js";
import { RemoteApiClient } from "./remote.js";
import { readTrackedRuns, type TrackedRunRecord, isTerminalRunStatus, updateTrackedRun } from "./runs.js";
import { login, readSession } from "./session.js";

function roleColor(role: AgentMessage["role"]) {
  switch (role) {
    case "user":
      return "cyan";
    case "assistant":
      return "green";
    case "tool":
      return "yellow";
    default:
      return "gray";
  }
}

function roleLabel(role: AgentMessage["role"]) {
  switch (role) {
    case "user":
      return "you";
    case "assistant":
      return "research";
    case "tool":
      return "tool";
    default:
      return "system";
  }
}

type InteractiveAppProps = {
  altScreen?: boolean;
};

const THINKING_VERBS = ["thinking", "planning", "interpreting", "resolving"];
const WORKING_VERBS = [
  "working",
  "uploading",
  "deploying",
  "tracking",
  "syncing",
  "running",
  "checking",
  "processing",
];
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
    }, 420);

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

  const activityText = useMemo(() => {
    if (status === "idle") {
      return "ready";
    }
    const verbs = status === "thinking" ? THINKING_VERBS : WORKING_VERBS;
    const verb = verbs[statusTick % verbs.length] ?? (status === "thinking" ? "thinking" : "working");
    const frame = STATUS_FRAMES[statusTick % STATUS_FRAMES.length] ?? "";
    return `${verb}${frame}`;
  }, [status, statusTick]);

  const header = useMemo(() => {
    const auth = session ? "signed in" : "not signed in";
    const activeRuns = trackedRuns.filter((item) => !item.terminalAt && !isTerminalRunStatus(item.status));
    const runText = activeRuns.length > 0
      ? `runs ${activeRuns.length}: ${activeRuns.slice(0, 3).map((item) => `${item.id}:${item.status}`).join(", ")}`
      : "runs 0";
    return `RESEARCH  ${auth}  ${activityText}  ${runText}  ${currentOrigin(session)}`;
  }, [activityText, session, trackedRuns]);

  const transcriptItems = useMemo(
    () => messages.flatMap((message, messageIndex) =>
      message.content.split("\n").map((line, lineIndex) => ({
        key: `${messageIndex}-${lineIndex}-${message.role}`,
        role: message.role,
        line: line.length > 0 ? line : " ",
      })),
    ),
    [messages],
  );

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="gray" wrap="truncate-end">{header}</Text>
      </Box>

      <Static items={transcriptItems}>
        {(message) => (
          <Box key={message.key}>
            <Text color={roleColor(message.role)}>{`${roleLabel(message.role)}> `}</Text>
            <Text wrap="truncate-end">{message.line}</Text>
          </Box>
        )}
      </Static>

      <Box marginTop={1}>
        <Text color="cyan">{"> "}</Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={() => {
            void submit();
          }}
          placeholder="sign in, create a dataset, deploy it, or manage runs"
        />
      </Box>

      <Box marginTop={1}>
        <Text color="gray" wrap="truncate-end">
          {altScreen ? "/login  /exit  Ctrl-C" : "/login  /exit  Esc"}  |  local root: {DEFAULT_INSTANCE_ROOT}
        </Text>
      </Box>

      {status !== "idle" ? (
        <Box>
          <Text color={status === "thinking" ? "yellow" : "cyan"} wrap="truncate-end">
            {activityText}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}
