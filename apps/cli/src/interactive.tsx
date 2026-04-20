import React, { useEffect, useMemo, useState } from "react";
import { Box, Static, Text, useApp, useInput } from "ink";
import TextInput from "ink-text-input";

import { executeAction, planAction, type AgentMessage } from "./agent.js";
import { DEFAULT_WEB_ORIGIN, DEFAULT_INSTANCE_ROOT } from "./config.js";
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

export function InteractiveApp() {
  const { exit } = useApp();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      role: "assistant",
      content: [
        "RESEARCH is ready.",
        "Try: sign in",
        "Try: list local datasets",
        'Try: create a dataset from "/path/to/data.parquet" and deploy it',
      ].join("\n"),
    },
  ]);
  const [status, setStatus] = useState<"idle" | "thinking" | "working">("idle");
  const [busy, setBusy] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  useEffect(() => {
    void readSession().then((session) => {
      setSessionEmail(session ? session.origin : null);
    });
  }, []);

  useInput((_input, key) => {
    if (key.escape) {
      exit();
    }
    if (key.ctrl && _input === "c") {
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
      setMessages((current) => [...current, { role: "user", content: trimmed }]);
      setInput("");
      try {
        const session = await login({}, (message) => {
          setMessages((current) => [...current, { role: "tool", content: message }]);
        });
        setSessionEmail(session.origin);
        setMessages((current) => [...current, { role: "assistant", content: `Signed in to ${session.origin}.` }]);
      } catch (error) {
        setMessages((current) => [...current, { role: "assistant", content: error instanceof Error ? error.message : String(error) }]);
      } finally {
        setBusy(false);
        setStatus("idle");
      }
      return;
    }

    const nextMessages = [...messages, { role: "user", content: trimmed } satisfies AgentMessage];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);
    setStatus("thinking");

    try {
      const session = await readSession();
      const action = await planAction(trimmed, session);
      setStatus("working");
      await executeAction(action, (message) => {
        setMessages((current) => [...current, message]);
      });
    } catch (error) {
      setMessages((current) => [
        ...current,
        { role: "assistant", content: error instanceof Error ? error.message : String(error) },
      ]);
    } finally {
      setBusy(false);
      setStatus("idle");
    }
  }

  const header = useMemo(
    () => {
      const sessionText = sessionEmail ? `signed in: ${sessionEmail}` : "not signed in";
      const stateText = status === "idle" ? "ready" : status === "thinking" ? "thinking" : "working";
      return `RESEARCH  |  ${sessionText}  |  ${stateText}  |  ${DEFAULT_WEB_ORIGIN}`;
    },
    [sessionEmail, status],
  );

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
          placeholder="ask research to sign in, create datasets, deploy them, or start runs"
        />
      </Box>

      <Box marginTop={1}>
        <Text color="gray" wrap="truncate-end">
          /login  /exit  Esc  |  local root: {DEFAULT_INSTANCE_ROOT}
        </Text>
      </Box>
    </Box>
  );
}
