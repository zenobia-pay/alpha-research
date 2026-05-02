#!/usr/bin/env node
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { render } from "ink";

import { DEFAULT_INSTALL_COMMAND, type SessionRecord } from "./config.js";
import { getLocalDirectResponse, type AgentMessage, runAgentTurn } from "./agent.js";
import { runDebugCommand } from "./debug.js";
import { parseCliArgs, parseFlags } from "./flags.js";
import { InteractiveApp } from "./interactive.js";
import { buildInstallPrompt, handleFixture, printUsage, runScriptedCommand } from "./local-tools.js";
import { RemoteApiClient } from "./remote.js";
import { login, readSession } from "./session.js";

function extractPromptDatasetReference(prompt: string) {
  const explicit = prompt.match(/\b(?:the\s+)?([a-z0-9][a-z0-9_-]*)\s+dataset\b/i);
  if (explicit?.[1]) {
    return explicit[1];
  }
  const implicit = prompt.match(/\bdataset\s+([a-z0-9][a-z0-9_-]*)\b/i);
  return implicit?.[1] ?? null;
}

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
  if (/^Dashboard:\s+https?:\/\//.test(line)) {
    return [line];
  }
  if (line.length <= width) {
    return [line];
  }
  const wrapped: string[] = [];
  let remaining = line;
  while (remaining.length > width) {
    const breakAt = remaining.lastIndexOf(" ", width);
    const slashBreakAt = Math.max(remaining.lastIndexOf("/", width), remaining.lastIndexOf("\\", width));
    const splitIndex = breakAt > 0
      ? breakAt
      : slashBreakAt > 0
        ? slashBreakAt + 1
        : width;
    wrapped.push(remaining.slice(0, splitIndex).trimEnd());
    remaining = remaining.slice(splitIndex).trimStart();
  }
  wrapped.push(remaining);
  return wrapped;
}

export function initialPromptModeStatus(prompt: string) {
  const lower = prompt.trim().toLowerCase();
  const datasetReference = extractPromptDatasetReference(prompt);
  const isReadinessCheck = /\b(can i trust|trust enough|usable right now|use it for|ready for|readiness|fix it first)\b/.test(lower)
    && /\bdataset\b/.test(lower);
  if (
    /\b(private|local)\b/.test(lower)
    && /\b(csv|tsv|parquet|jsonl?|spreadsheet|export|file)\b/.test(lower)
    && /\b(public|changelog|release notes?)\b/.test(lower)
    && /\bapi\b/.test(lower)
    && /\bdocs?\b/.test(lower)
  ) {
    return "Waiting for source-of-truth details before any dataset build can start.";
  }
  if (
    /\b(came back|back later|return later|returned later|recent work|my research work)\b/.test(lower)
    && /\b(what happened|results?|artifacts?|status|progress|can i see|show me)\b/.test(lower)
  ) {
    return "Checking recent research work...";
  }
  if (
    /\b(blocked|stuck|failed|failure|what is happening|what happened|status|progress)\b/.test(lower)
    && /\b(do next|next step|recover|recovery|anything useful|useful was produced|artifacts?)\b/.test(lower)
  ) {
    return "Checking active work, useful outputs, and the best next step...";
  }
  if (/\bwhich dataset should i use\b/.test(lower)) {
    return "Looking up candidate datasets...";
  }
  if (/\bdataset\b/.test(lower) && /\binterest(?:ing)?\b/.test(lower) && /\banaly[sz]e\b/.test(lower)) {
    return "Preparing a quick dataset briefing...";
  }
  if (/\bhousing market\b/.test(lower) && /\b(trouble|crash|bad|risk|look into)\b/.test(lower)) {
    return "Needs your input: scope clarification.";
  }
  if (/\bcreate\b|\bupload\b|\bimport\b|\bdeploy\b/.test(lower)) {
    return "Starting dataset creation...";
  }
  if (/\bwhat does\b|\bmeaning\b|\bmean\b|\bfield\b|\bschema\b/.test(lower)) {
    return "Checking dataset metadata...";
  }
  if (/\bresult\b|\bartifact\b|\blast run\b|\bstatus\b|\bprogress\b/.test(lower)) {
    return "Checking run state...";
  }
  if (/\bdataset\b|\bsource\b|\bcoverage\b|\bquality\b|\blimitation\b|\btrust\b|\btrustworthy\b|\bprovenance\b|\bwhat'?s inside\b|\bwhere it came from\b|\bunderstand\b/.test(lower)) {
    if (isReadinessCheck) {
      return datasetReference
        ? `Readiness check for ${datasetReference}: trust, coverage, join keys, missingness, fix-first verdict...`
        : "Readiness check: trust, coverage, join keys, missingness, fix-first verdict...";
    }
    return datasetReference
      ? `Inspecting ${datasetReference}: sources, schema, coverage, quality, limitations...`
      : "Inspecting dataset: sources, schema, coverage, quality, limitations...";
  }
  if (/\bviral tweets?\b|\bquote_tweet_count\b|\bstrict json\b|\brepresentative examples\b/.test(lower)) {
    return "Scoping experiment design...";
  }
  if (/\banaly[sz]e\b|\bresearch\b|\bhypothesis\b|\bexperiment\b/.test(lower)) {
    return "Planning dataset-backed research...";
  }
  return "Thinking...";
}

function printPromptModeHeader() {
  console.log("research");
}

function promptModeKickoffMessage(prompt: string) {
  const datasetReference = extractPromptDatasetReference(prompt);
  const viralTweetsMatch = prompt.match(/\busing\s+([a-z0-9][a-z0-9_-]*)\b/i);
  if (
    viralTweetsMatch?.[1]
    && /\bviral tweets?\b/i.test(prompt)
    && /\bquote_tweet_count\b/i.test(prompt)
    && /\bstrict json\b/i.test(prompt)
  ) {
    const examplesMatch = prompt.match(/\b(\d+)\s+representative examples\b/i);
    return `Request understood: use ${viralTweetsMatch[1]} and preserve top 0.1%, random sample of 100, strict JSON labels, a bar chart, and ${examplesMatch?.[1] ?? "representative"} examples.`;
  }
  if (
    datasetReference
    && /\bdataset\b/i.test(prompt)
    && /\b(trust|trustworthy|provenance|source|sources|quality|limitation|limitations|what'?s inside|where it came from|understand)\b/i.test(prompt)
  ) {
    if (/\b(can i trust|trust enough|usable right now|use it for|ready for|readiness|fix it first)\b/i.test(prompt)) {
      return `Readiness check, not analysis: assess whether ${datasetReference} is usable now, what evidence supports that, and what must be fixed first.`;
    }
    return `Request understood: brief ${datasetReference} with sources, schema, coverage, quality checks, limitations, and trust signals.`;
  }
  const datasetMatch = prompt.match(/\busing\s+the\s+([a-z0-9][a-z0-9_-]*)\s+dataset\b/i)
    ?? prompt.match(/\busing\s+([a-z0-9][a-z0-9_-]*)\b/i);
  const yearRangeMatch = prompt.match(/\bfrom\s+(\d{4})\s+(?:through|to)\s+(\d{4})\b/i);
  const groupByMatch = prompt.match(/\bgroup by\s+([^.,;]+)\b/i);
  const outputs = [
    /\bcorrelation table\b/i.test(prompt) ? "correlation table" : null,
    /\bscatter plot\b/i.test(prompt) ? "scatter plot" : null,
    /\bmarkdown summary\b/i.test(prompt) ? "markdown summary" : null,
  ].filter((value): value is string => value !== null);
  if (!datasetMatch?.[1] || !yearRangeMatch || !groupByMatch || outputs.length === 0) {
    return null;
  }
  return `Request understood: use ${datasetMatch[1]} to analyze the requested comparison from ${yearRangeMatch[1]} through ${yearRangeMatch[2]}, grouped by ${groupByMatch[1].trim()}, and return ${outputs.join(", ")}.`;
}

function formatPromptModeMessage(message: AgentMessage, previousMessages: AgentMessage[]) {
  const content = message.content.trim();
  if (!content) {
    return null;
  }
  if (message.role === "tool") {
    if (content === "Analyzing request...") {
      return null;
    }
    if (/^Checking remote datasets\.\.\.$/u.test(content)) {
      return {
        ...message,
        content: "Checking that the named dataset is available...",
      };
    }
    if (/^Found \d+ remote datasets\.$/u.test(content)) {
      return null;
    }
    const shortlistMatch = content.match(/^Found \d+ remote datasets\.\nTop matches for "([^"]+)":\n1\. ([^\s]+) \(([^)]+)\) [—-] ([^\n]+)(?:\n|$)/u);
    if (shortlistMatch) {
      return {
        ...message,
        content: `Dataset selected: ${shortlistMatch[2]} is the best match for "${shortlistMatch[1]}". Checking its saved profile and readiness evidence now.`,
      };
    }
    if (content.startsWith("Top matches for ")) {
      return null;
    }
    if (content.startsWith("Run startup: waiting for backend worker")) {
      return {
        ...message,
        content: content.replace("Run startup:", "Still initializing:"),
      };
    }
    if (content.startsWith("Run startup: request accepted")) {
      return {
        ...message,
        content: content.replace("Run startup:", "Still initializing:"),
      };
    }
    if (content.startsWith("Run startup: backend worker still initializing")) {
      return {
        ...message,
        content: content.replace("Run startup:", "Still initializing:"),
      };
    }
    if (content === "Searching datasets...") {
      return {
        ...message,
        content: "Locating the requested dataset...",
      };
    }
    if (content === "Waiting for your approval before starting a run.") {
      return {
        ...message,
        content: "Scoping experiment design complete. Waiting for your choice before starting a run.",
      };
    }
    const previousContent = previousMessages.at(-1)?.content.trim();
    if (previousContent === content) {
      return null;
    }
  }
  return message;
}

function hasSubstantivePromptModeVerdict(messages: AgentMessage[]) {
  const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant")?.content ?? "";
  return /\b(Readiness & Trust|Short answer:|Usable now|Fix first|Dataset Briefing:|Overview:)\b/u.test(latestAssistant);
}

function parseStartedDatasetBriefingRun(messages: AgentMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const content = messages[index]?.content ?? "";
    const match = content.match(/Started dataset briefing run ([a-z0-9-]+) for ([a-z0-9_-]+)/i);
    if (match) {
      return { runId: match[1]!, datasetId: match[2]! };
    }
  }
  return null;
}

function previewDatasetBriefingContent(artifacts: Array<{ title?: string; type?: string; content?: unknown }>) {
  const preferred = artifacts.find((artifact) => artifact.title === "Dataset Briefing" && typeof artifact.content === "string")
    ?? artifacts.find((artifact) => artifact.type === "markdown" && typeof artifact.content === "string")
    ?? artifacts.find((artifact) => typeof artifact.content === "string" && artifact.title?.endsWith(".md"));
  const content = typeof preferred?.content === "string" ? preferred.content.trim() : "";
  return content || null;
}

async function watchPromptModeDatasetBriefing(session: SessionRecord, runId: string, datasetId: string) {
  const client = new RemoteApiClient(session);
  const timeoutMs = Number(process.env.RESEARCH_PROMPT_BRIEFING_WAIT_MS ?? "30000");
  const pollMs = Number(process.env.RESEARCH_PROMPT_BRIEFING_POLL_MS ?? "5000");
  const startedAt = Date.now();
  let lastStatus = "";

  printAgentMessage({ role: "tool", content: `Generating briefing for ${datasetId}...` });

  while (Date.now() - startedAt < timeoutMs) {
    const payload = await client.getRunResults(runId).catch(() => null);
    if (payload) {
      const status = payload.run.status?.toLowerCase() ?? "unknown";
      if (status !== lastStatus) {
        lastStatus = status;
        printAgentMessage({
          role: "tool",
          content: `Run ${runId} is ${status === "booting" ? "starting" : status}${payload.run.updatedAt ? ` · last update ${payload.run.updatedAt}` : ""}.`,
        });
      } else {
        printAgentMessage({
          role: "tool",
          content: `Still generating briefing for ${datasetId}...`,
        });
      }
      const preview = previewDatasetBriefingContent(payload.artifacts);
      if (preview) {
        printAgentMessage({ role: "assistant", content: preview });
        return;
      }
      if (["ready", "completed", "succeeded"].includes(status)) {
        printAgentMessage({
          role: "assistant",
          content: [
            `Dataset briefing run ${runId} finished for ${datasetId}.`,
            "The artifacts are ready on the run page, but the briefing body was not included in the CLI response.",
            `Run: ${runId}`,
          ].join("\n"),
        });
        return;
      }
      if (["failed", "error", "cancelled", "canceled", "worker_unreachable", "unknown"].includes(status)) {
        printAgentMessage({
          role: "assistant",
          content: `Dataset briefing run ${runId} ended ${status}. Inspect it with \`research debug run ${runId}\`.`,
        });
        return;
      }
    } else {
      printAgentMessage({ role: "tool", content: `Still generating briefing for ${datasetId}...` });
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  printAgentMessage({
    role: "assistant",
    content: [
      `Dataset briefing for ${datasetId} is still running in the background.`,
      `Run: ${runId}`,
      `Next: check \`research debug run ${runId}\` for live status or ask for the latest results once it finishes.`,
    ].join("\n"),
  });
}

async function runPromptMode(prompt: string) {
  const localDirectResponse = getLocalDirectResponse(prompt);
  if (localDirectResponse) {
    console.log("research");
    printAgentMessage({ role: "assistant", content: localDirectResponse });
    return null;
  }
  printPromptModeHeader();
  const session = await readSession();
  const messages: AgentMessage[] = [];
  const emit = (message: AgentMessage) => {
    const formatted = formatPromptModeMessage(message, messages);
    if (!formatted) {
      return;
    }
    messages.push(formatted);
    printAgentMessage(formatted);
  };
  emit({ role: "tool", content: promptModeKickoffMessage(prompt) ?? initialPromptModeStatus(prompt) });
  const conversationState = await runAgentTurn(prompt, session, emit);
  const startedBriefing = session ? parseStartedDatasetBriefingRun(messages) : null;
  if (session && startedBriefing && !hasSubstantivePromptModeVerdict(messages)) {
    await watchPromptModeDatasetBriefing(session, startedBriefing.runId, startedBriefing.datasetId);
  }
  return conversationState;
}

export function isDirectCliExecution(argvEntry = process.argv[1]) {
  if (!argvEntry) {
    return false;
  }
  return fileURLToPath(import.meta.url) === resolve(argvEntry);
}

export function shouldExitPromptMode(argvEntry = process.argv[1]) {
  if (!argvEntry) {
    return false;
  }
  return isDirectCliExecution(argvEntry) || /(?:^|[/\\])dist[/\\]index\.js$/u.test(argvEntry);
}

async function exitPromptModeProcess() {
  process.exit(process.exitCode ?? 0);
}

export async function main() {
  const argv = process.argv.slice(2);
  const { flags, positionals } = parseCliArgs(argv);
  const [command, ...rest] = positionals;
  const promptFlag = typeof flags.prompt === "string" ? flags.prompt.trim() : "";

  if (promptFlag) {
    await runPromptMode(promptFlag);
    if (shouldExitPromptMode()) {
      await exitPromptModeProcess();
    }
    return;
  }

  if (!command || command === "agent" || command === "chat") {
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
    if (shouldExitPromptMode()) {
      await exitPromptModeProcess();
    }
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

if (isDirectCliExecution()) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
