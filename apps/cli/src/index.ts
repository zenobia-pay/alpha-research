#!/usr/bin/env node
import React from "react";
import { render } from "ink";

import { DEFAULT_INSTALL_COMMAND, type SessionRecord } from "./config.js";
import { type AgentMessage, runAgentTurn } from "./agent.js";
import { runDebugCommand } from "./debug.js";
import { parseCliArgs, parseFlags } from "./flags.js";
import { buildInstallPrompt, handleFixture, printUsage, runScriptedCommand } from "./local-tools.js";
import { login, readSession } from "./session.js";

function enterAltScreen() {
  process.stdout.write("\u001b[?1049h\u001b[H");
}

function leaveAltScreen() {
  process.stdout.write("\u001b[?1049l");
}

function printAgentMessage(message: AgentMessage) {
  const prefix = message.role === "tool" ? "· " : "";
  const lines = message.content.split("\n");
  for (const line of lines) {
    const wrapped = wrapForStdout(`${prefix}${line}`);
    for (const wrappedLine of wrapped) {
      console.log(wrappedLine);
    }
  }
}

function wrapForStdout(line: string) {
  const width = Math.max(40, Number.isFinite(process.stdout.columns) ? (process.stdout.columns ?? 0) : 0);
  if (line.length <= width) {
    return [line];
  }
  const wrapped: string[] = [];
  let remaining = line;
  while (remaining.length > width) {
    const breakAt = remaining.lastIndexOf(" ", width);
    const splitIndex = breakAt > 0 ? breakAt : width;
    wrapped.push(remaining.slice(0, splitIndex).trimEnd());
    remaining = remaining.slice(splitIndex).trimStart();
  }
  wrapped.push(remaining);
  return wrapped;
}

async function runPromptMode(prompt: string) {
  const session = await readSession();
  const conversationState = await runAgentTurn(prompt, session, printAgentMessage);
  return conversationState;
}

async function main() {
  const argv = process.argv.slice(2);
  const { flags, positionals } = parseCliArgs(argv);
  const [command, ...rest] = positionals;
  const promptFlag = typeof flags.prompt === "string" ? flags.prompt.trim() : "";

  if (promptFlag) {
    await runPromptMode(promptFlag);
    return;
  }

  if (!command || command === "agent" || command === "chat") {
    const { InteractiveApp } = await import("./interactive.js");
    const altScreen = flags["alt-screen"] === "true";
    if (altScreen) {
      enterAltScreen();
      const restore = () => {
        leaveAltScreen();
      };
      process.on("exit", restore);
      process.on("SIGINT", () => {
        leaveAltScreen();
        process.exit(130);
      });
    }
    render(React.createElement(InteractiveApp, { altScreen }));
    return;
  }

  if (command === "prompt") {
    const prompt = rest.join(" ").trim();
    if (!prompt) {
      throw new Error("Missing prompt text. Use `research prompt \"...\"` or `research --prompt \"...\"`.");
    }
    await runPromptMode(prompt);
    return;
  }

  if (command === "help" || command === "--help") {
    printUsage();
    return;
  }

  if (command === "install-prompt") {
    console.log(buildInstallPrompt(flags, DEFAULT_INSTALL_COMMAND));
    return;
  }

  if (command === "login") {
    await login(flags);
    return;
  }

  if (command === "whoami") {
    const session = await readSession();
    if (!session) {
      console.log("No RESEARCH CLI session found.");
      process.exitCode = 1;
      return;
    }
    console.log(JSON.stringify({
      origin: session.origin,
      createdAt: session.createdAt,
      accessTokenPreview: `${session.accessToken.slice(0, 8)}...`,
    }, null, 2));
    return;
  }

  if (command === "debug") {
    await runDebugCommand(rest, flags);
    return;
  }

  if (command === "fixture") {
    const [fixtureCommand, datasetId, ...tail] = rest;
    await handleFixture(fixtureCommand, datasetId, parseFlags(tail));
    return;
  }

  if (await runScriptedCommand(command, rest, flags)) {
    return;
  }

  printUsage();
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
