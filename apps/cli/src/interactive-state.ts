import type { AgentMessage } from "./agent.js";
import { isTerminalRunStatus, type TrackedRunRecord } from "./runs.js";

export type TaskStatus = "ready" | "working" | "waiting" | "blocked" | "done";

export type InteractiveTaskState = {
  goal: string | null;
  status: TaskStatus;
  currentStep: string | null;
  lastResult: string | null;
  nextExpectedOutput: string | null;
  planSteps: string[];
  activity: string[];
  focusRunId: string | null;
};

export function createIdleTaskState(): InteractiveTaskState {
  return {
    goal: null,
    status: "ready",
    currentStep: null,
    lastResult: null,
    nextExpectedOutput: null,
    planSteps: [],
    activity: [],
    focusRunId: null,
  };
}

export function beginInteractiveTask(prompt: string): InteractiveTaskState {
  return {
    goal: prompt,
    status: "working",
    currentStep: "Understanding the request and checking relevant datasets.",
    lastResult: null,
    nextExpectedOutput: inferNextExpectedOutput(prompt),
    planSteps: inferPlanSteps(prompt),
    activity: [],
    focusRunId: null,
  };
}

export function applyAgentMessageToTaskState(
  state: InteractiveTaskState,
  message: AgentMessage,
): InteractiveTaskState {
  const cleaned = cleanUiLine(message.content);
  if (!cleaned) {
    return state;
  }
  if (isHiddenRunNoise(cleaned)) {
    return state;
  }

  const next = {
    ...state,
    activity: appendUnique(state.activity, cleaned),
  };

  if (message.role === "assistant") {
    return {
      ...next,
      status: deriveAssistantStatus(cleaned),
      lastResult: cleaned,
      focusRunId: extractRunId(cleaned) ?? next.focusRunId,
      nextExpectedOutput: inferNextExpectedFromMessage(cleaned) ?? next.nextExpectedOutput,
    };
  }

  if (looksLikeProgress(cleaned)) {
    return {
      ...next,
      status: "working",
      currentStep: cleaned,
      nextExpectedOutput: inferNextExpectedFromProgress(cleaned) ?? next.nextExpectedOutput,
    };
  }

  return {
    ...next,
    lastResult: cleaned,
    focusRunId: extractRunId(cleaned) ?? next.focusRunId,
    nextExpectedOutput: inferNextExpectedFromMessage(cleaned) ?? next.nextExpectedOutput,
  };
}

export function buildLiveSummary(state: InteractiveTaskState) {
  const lines = ["Working on your request."];
  if (state.currentStep) lines.push(`Current step: ${state.currentStep}`);
  if (state.lastResult) lines.push(`Last result: ${state.lastResult}`);
  if (state.nextExpectedOutput) lines.push(`Next expected output: ${state.nextExpectedOutput}`);
  return lines.join("\n");
}

export function wrapText(text: string, width: number) {
  const safeWidth = Math.max(12, width);
  return text
    .split("\n")
    .flatMap((line) => wrapLine(line, safeWidth));
}

export function splitTrackedRuns(runs: TrackedRunRecord[], focusRunId: string | null) {
  const active = runs
    .filter((item) => !item.terminalAt && !isTerminalRunStatus(item.status))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  return {
    focused: focusRunId ? active.find((item) => item.id === focusRunId) ?? null : null,
    background: active.filter((item) => item.id !== focusRunId),
  };
}

export function cleanUiLine(text: string) {
  return text.replace(/\s+/gu, " ").trim();
}

export function isHiddenRunNoise(text: string) {
  return /^\[run [^\]]+\]/u.test(text) || /\b(?:Running|Completed) command:/u.test(text);
}

function inferPlanSteps(prompt: string) {
  const lower = prompt.toLowerCase();
  if (/\b(dataset|manifest|data dictionary|missingness|row counts|join keys?|temporal coverage)\b/u.test(lower)) {
    return [
      "Discover candidate sources",
      "Validate URLs and coverage",
      "Assemble county-month joins",
      "Check row counts and missingness",
      "Write manifest and data dictionary",
    ];
  }
  return [
    "Interpret the request",
    "Gather the needed context",
    "Run the scoped work",
    "Return artifacts and next steps",
  ];
}

function inferNextExpectedOutput(prompt: string) {
  const lower = prompt.toLowerCase();
  if (/\b(dataset|build|manifest|data dictionary)\b/u.test(lower)) {
    return "A build run or scoped plan with expected artifacts.";
  }
  return "A concise result or a focused follow-up question.";
}

function inferNextExpectedFromProgress(text: string) {
  if (/Checking remote datasets/u.test(text)) return "A recommendation or build kickoff based on available datasets.";
  if (/Starting dataset build/u.test(text)) return "A remote build run with artifact expectations.";
  if (/Inspecting dataset/u.test(text)) return "A dataset briefing or a readiness summary.";
  return null;
}

function inferNextExpectedFromMessage(text: string) {
  if (/Started .* run /u.test(text) || /Started research environment build/u.test(text) || /Queued /u.test(text)) {
    return "Run status updates plus artifacts like a manifest, validation report, or briefing.";
  }
  if (isBlockedAssistantMessage(text)) {
    return "A user action to unblock the request.";
  }
  if (isWaitingForUserReply(text)) {
    return "A short user reply so RESEARCH can continue with the right scope.";
  }
  return null;
}

function deriveAssistantStatus(text: string): TaskStatus {
  if (isBlockedAssistantMessage(text)) return "blocked";
  if (/Started .* run |Started research environment build|Queued |Cancelled run /u.test(text)) return "waiting";
  if (isWaitingForUserReply(text)) return "waiting";
  return "done";
}

function looksLikeProgress(text: string) {
  return /\.\.\.$/u.test(text) || /^(Checking|Inspecting|Starting|Resolving|Creating|Preparing|Uploading|Finalizing|Deploying|Retrieving)\b/u.test(text);
}

function extractRunId(text: string) {
  const match = text.match(/\brun[-\w]*/u);
  return match?.[0] ?? null;
}

function isBlockedAssistantMessage(text: string) {
  return /Blocked:|Sign in first/u.test(text);
}

function isWaitingForUserReply(text: string) {
  return /Waiting for your answer/u.test(text)
    || /Reply with /u.test(text)
    || /Which geography matters most/u.test(text)
    || /I can help with that, but I need 2 things first:/u.test(text)
    || /No upload is needed\./u.test(text);
}

function appendUnique(items: string[], item: string) {
  if (items.at(-1) === item) {
    return items;
  }
  return [...items, item].slice(-6);
}

function wrapLine(line: string, width: number) {
  if (!line) return [""];
  const words = line.split(/\s+/u);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if (`${current} ${word}`.length <= width) {
      current = `${current} ${word}`;
      continue;
    }
    lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines;
}
