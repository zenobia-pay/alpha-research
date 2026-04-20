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

export function InteractiveApp() {
  const { exit } = useApp();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      role: "assistant",
      content: [
        "RESEARCH agent is ready.",
        `Sign in target: ${DEFAULT_WEB_ORIGIN}`,
        `Local dataset root: ${DEFAULT_INSTANCE_ROOT}`,
        "",
        "Try:",
        "- sign in",
        "- list local datasets",
        '- create a dataset from "/path/to/data.parquet" and deploy it',
        '- start a run on dataset my-dataset with prompt "find wage trends"',
      ].join("\n"),
    },
  ]);
  const [status, setStatus] = useState("Idle");
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
      setStatus("Signing in");
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
        setStatus("Idle");
      }
      return;
    }

    const nextMessages = [...messages, { role: "user", content: trimmed } satisfies AgentMessage];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);
    setStatus("Planning");

    try {
      const session = await readSession();
      const action = await planAction(trimmed, session);
      setStatus(`Executing ${action.type}`);
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
      setStatus("Idle");
    }
  }

  const header = useMemo(
    () => `Session: ${sessionEmail ?? "not signed in"} · ${status}${busy ? "…" : ""}`,
    [busy, sessionEmail, status],
  );

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1} flexDirection="column">
        <Text bold color="magenta">RESEARCH</Text>
        <Text color="gray">{header}</Text>
      </Box>

      <Box borderStyle="round" borderColor="gray" paddingX={1} paddingY={0} flexDirection="column" minHeight={18}>
        <Static items={messages.slice(-20)}>
          {(message, index) => (
            <Box key={`${index}-${message.role}`} flexDirection="column" marginBottom={1}>
              <Text color={roleColor(message.role)}>{message.role}</Text>
              {message.content.split("\n").map((line, lineIndex) => (
                <Text key={lineIndex}>{line}</Text>
              ))}
            </Box>
          )}
        </Static>
      </Box>

      <Box marginTop={1}>
        <Text color="cyan">{"> "}</Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={() => {
            void submit();
          }}
          placeholder="Ask RESEARCH to sign in, create datasets, deploy them, or start runs"
        />
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color="gray">Shortcuts: `/login`, `/exit`, `Esc`</Text>
      </Box>
    </Box>
  );
}
