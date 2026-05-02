import type { AgentMessage } from "./agent.js";
import { isTerminalRunStatus, type TrackedRunRecord } from "./runs.js";

export type TaskStatus = "ready" | "working" | "waiting" | "blocked" | "done";

export type InteractiveTaskState = {
  goal: string | null;
  status: TaskStatus;
  statusLabel: string | null;
  currentStep: string | null;
  lastResult: string | null;
  nextExpectedOutput: string | null;
  planSteps: string[];
  activity: string[];
  focusRunId: string | null;
  focusRunUrl: string | null;
  selectedDatasetId: string | null;
  selectedDatasetState: string | null;
  startedAt: number | null;
};

export function createIdleTaskState(): InteractiveTaskState {
  return {
    goal: null,
    status: "ready",
    statusLabel: null,
    currentStep: null,
    lastResult: null,
    nextExpectedOutput: null,
    planSteps: [],
    activity: [],
    focusRunId: null,
    focusRunUrl: null,
    selectedDatasetId: null,
    selectedDatasetState: null,
    startedAt: null,
  };
}

export function beginInteractiveTask(prompt: string): InteractiveTaskState {
  const recoveryFlow = inferRecoveryFlow(prompt);
  const orientationFlow = inferOrientationFlow(prompt);
  const runStartFlow = inferRunStartFlow(prompt);
  return {
    goal: prompt,
    status: "working",
    statusLabel: null,
    currentStep: orientationFlow?.currentStep ?? recoveryFlow?.currentStep ?? runStartFlow?.currentStep ?? "Understanding the request and checking relevant datasets.",
    lastResult: null,
    nextExpectedOutput: orientationFlow?.nextExpectedOutput ?? recoveryFlow?.nextExpectedOutput ?? runStartFlow?.nextExpectedOutput ?? inferNextExpectedOutput(prompt),
    planSteps: orientationFlow?.planSteps ?? recoveryFlow?.planSteps ?? runStartFlow?.planSteps ?? inferPlanSteps(prompt),
    activity: [],
    focusRunId: null,
    focusRunUrl: null,
    selectedDatasetId: extractDatasetIdFromPrompt(prompt),
    selectedDatasetState: null,
    startedAt: Date.now(),
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
    activity: message.role === "assistant" ? state.activity : appendUnique(state.activity, cleaned),
  };

  if (message.role === "assistant") {
    const runId = extractRunId(cleaned) ?? next.focusRunId;
    const focusRunUrl = extractDashboardUrl(cleaned) ?? next.focusRunUrl;
    const blockedDataset = extractBlockedDataset(cleaned);
    return {
      ...next,
      status: deriveAssistantStatus(cleaned),
      statusLabel: deriveAssistantStatusLabel(cleaned),
      currentStep: deriveAssistantCurrentStep(cleaned) ?? next.currentStep,
      lastResult: cleaned,
      focusRunId: runId,
      focusRunUrl,
      selectedDatasetId: blockedDataset?.id ?? extractDatasetIdFromAssistant(cleaned) ?? next.selectedDatasetId,
      selectedDatasetState: blockedDataset?.state ?? next.selectedDatasetState,
      nextExpectedOutput: inferNextExpectedFromMessage(cleaned) ?? next.nextExpectedOutput,
    };
  }

  if (looksLikeProgress(cleaned)) {
    const progressStatus = /^Waiting\b/u.test(cleaned) || /Waiting for your (?:approval|choice|reply)\b/u.test(cleaned)
      ? "waiting"
      : "working";
    return {
      ...next,
      status: progressStatus,
      statusLabel: deriveProgressStatusLabel(cleaned, progressStatus),
      currentStep: cleaned,
      selectedDatasetId: extractDatasetIdFromProgress(cleaned) ?? next.selectedDatasetId,
      selectedDatasetState: extractDatasetStateFromProgress(cleaned) ?? next.selectedDatasetState,
      nextExpectedOutput: inferNextExpectedFromProgress(cleaned) ?? next.nextExpectedOutput,
    };
  }

  return {
    ...next,
    lastResult: cleaned,
    focusRunId: extractRunId(cleaned) ?? next.focusRunId,
    focusRunUrl: extractDashboardUrl(cleaned) ?? next.focusRunUrl,
    nextExpectedOutput: inferNextExpectedFromMessage(cleaned) ?? next.nextExpectedOutput,
  };
}

export function buildLiveSummary(state: InteractiveTaskState) {
  const lines = [state.status === "done" ? "Ready for your next question." : "Working on your request."];
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
  if (isOrientationPrompt(lower)) {
    return [];
  }
  if (isRunStartPrompt(lower)) {
    return [
      "Check the named dataset",
      "Verify readiness or explain the block",
      "Start the run or hand off the next action",
    ];
  }
  if (isRecoveryPrompt(lower)) {
    return [
      "Check active work",
      "Look for useful outputs",
      "Separate facts from uncertainty",
      "Recommend the next recovery step",
    ];
  }
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
  if (isOrientationPrompt(lower)) {
    return "A short orientation answer with the best first command to try.";
  }
  if (isRunStartPrompt(lower)) {
    return "A clear dataset readiness check, then either a run id and dashboard link or a concrete block.";
  }
  if (isRecoveryPrompt(lower)) {
    return "A plain-language diagnosis, any useful outputs, and the best next step.";
  }
  if (/\b(dataset|build|manifest|data dictionary)\b/u.test(lower)) {
    return "A build run or scoped plan with expected artifacts.";
  }
  return "A concise result or a focused follow-up question.";
}

function inferRecoveryFlow(prompt: string) {
  const lower = prompt.toLowerCase();
  if (!isRecoveryPrompt(lower)) {
    return null;
  }
  return {
    currentStep: "Checking active work, useful outputs, and the safest next step.",
    nextExpectedOutput: "A plain-language diagnosis, any useful outputs, and the best next step.",
    planSteps: inferPlanSteps(prompt),
  };
}

function inferOrientationFlow(prompt: string) {
  const lower = prompt.toLowerCase();
  if (!isOrientationPrompt(lower)) {
    return null;
  }
  return {
    currentStep: "Checking the main actions RESEARCH can help with.",
    nextExpectedOutput: "A short orientation answer with the best first command to try.",
    planSteps: [] as string[],
  };
}

function inferRunStartFlow(prompt: string) {
  const lower = prompt.toLowerCase();
  if (!isRunStartPrompt(lower)) {
    return null;
  }
  return {
    currentStep: "Checking whether the named dataset is ready for this run.",
    nextExpectedOutput: "A clear dataset readiness check, then either a run id and dashboard link or a concrete block.",
    planSteps: inferPlanSteps(prompt),
  };
}

function inferNextExpectedFromProgress(text: string) {
  if (/Checking remote datasets/u.test(text)) return "A dataset match and readiness check for this request.";
  if (/Dataset selected:/u.test(text)) return "Either a run kickoff or a clear readiness/blocking update for the selected dataset.";
  if (/Planning run:/u.test(text)) return "A remote run kickoff that preserves the requested sampling, labeling, and output design.";
  if (/Starting dataset build/u.test(text)) return "A remote build run with artifact expectations.";
  if (/Inspecting dataset/u.test(text)) return "A dataset briefing or a readiness summary.";
  if (/Starting remote analysis for /u.test(text)) return "A run id, dashboard link, and expected artifacts for the active run.";
  if (/Waiting for your approval before starting a run\./u.test(text) || /Waiting for your choice before starting a run\./u.test(text)) {
    return "A short user reply so RESEARCH can continue with the agreed experiment scope.";
  }
  return null;
}

function inferNextExpectedFromMessage(text: string) {
  if (/Started .* run /u.test(text) || /Started research environment build/u.test(text) || /Queued /u.test(text)) {
    return "Run status updates plus artifacts like a manifest, validation report, or briefing.";
  }
  if (/I accepted the experiment design, but I did not start the run because /u.test(text)) {
    return "Wait for the dataset to become ready, then rerun the same prompt.";
  }
  if (isBlockedAssistantMessage(text)) {
    return "A user action to unblock the request.";
  }
  if (isWaitingForUserReply(text)) {
    return "A short user reply so RESEARCH can continue with the right scope.";
  }
  return null;
}

function deriveAssistantStatusLabel(text: string) {
  if (/Started .* run |Started research environment build|Queued /u.test(text)) return "Run started";
  if (/I accepted the experiment design, but I did not start the run because /u.test(text)) return "Waiting on dataset readiness";
  if (isBlockedAssistantMessage(text)) return "Blocked";
  if (/Before I start a remote run/u.test(text) || /Waiting for your approval/u.test(text)) return "Proposal";
  if (isWaitingForUserReply(text)) return "Waiting for input";
  return null;
}

function deriveAssistantStatus(text: string): TaskStatus {
  if (/I accepted the experiment design, but I did not start the run because /u.test(text)) return "blocked";
  if (isBlockedAssistantMessage(text)) return "blocked";
  if (/Started .* run |Started research environment build|Queued |Cancelled run /u.test(text)) return "waiting";
  if (isWaitingForUserReply(text)) return "waiting";
  return "done";
}

function deriveProgressStatusLabel(text: string, status: TaskStatus) {
  if (status === "waiting") {
    if (/starting a run/u.test(text)) return "Waiting for approval";
    return "Waiting for input";
  }
  return null;
}

function looksLikeProgress(text: string) {
  return /\.\.\.$/u.test(text) || /^(?:Checking|Inspecting|Starting|Resolving|Creating|Preparing|Uploading|Finalizing|Deploying|Retrieving|Waiting|Scoping)\b|^(?:Dataset selected:|Planning run:)/u.test(text);
}

function extractRunId(text: string) {
  const match = text.match(/\b(?:run[-_][\w-]+|[a-f0-9]{8,})\b/u);
  return match?.[0] ?? null;
}

function isBlockedAssistantMessage(text: string) {
  return /Blocked:|Blocked on |Sign in first/u.test(text)
    || /No remote run has started yet\./u.test(text)
    || /I need the dataset id before I can launch anything/u.test(text);
}

function extractDashboardUrl(text: string) {
  const match = text.match(/https?:\/\/\S+/u);
  return match?.[0] ?? null;
}

function extractDatasetIdFromPrompt(prompt: string) {
  const usingMatch = prompt.match(/\busing\s+([a-z0-9][a-z0-9_-]*)\b/i);
  if (usingMatch?.[1]) {
    return usingMatch[1];
  }
  const datasetMatch = prompt.match(/\b(?:the\s+)?([a-z0-9][a-z0-9_-]*)\s+dataset\b/i);
  return datasetMatch?.[1] ?? null;
}

function extractDatasetIdFromProgress(text: string) {
  const selectedMatch = text.match(/^Dataset selected:\s+([a-z0-9][a-z0-9_-]*)/iu);
  if (selectedMatch?.[1]) {
    return selectedMatch[1];
  }
  const analysisMatch = text.match(/^Starting remote analysis for\s+([a-z0-9][a-z0-9_-]*)/iu);
  return analysisMatch?.[1] ?? null;
}

function extractDatasetStateFromProgress(text: string) {
  const match = text.match(/^Dataset selected:\s+[a-z0-9][a-z0-9_-]*\s+\(([^)]+)\)/iu);
  return match?.[1] ?? null;
}

function extractDatasetIdFromAssistant(text: string) {
  const datasetLineMatch = text.match(/(?:^|\n)Dataset:\s+([a-z0-9][a-z0-9_-]*)/iu);
  if (datasetLineMatch?.[1]) {
    return datasetLineMatch[1];
  }
  const startedMatch = text.match(/Started remote analysis on\s+([a-z0-9][a-z0-9_-]*)/iu);
  return startedMatch?.[1] ?? null;
}

function extractBlockedDataset(text: string) {
  const firstLineMatch = text.match(/I accepted the experiment design, but I did not start the run because\s+`?([a-z0-9][a-z0-9_-]*)`?\s+is\s+([^.]+)\./iu);
  if (firstLineMatch?.[1] && firstLineMatch?.[2]) {
    return { id: firstLineMatch[1], state: firstLineMatch[2] };
  }
  return null;
}

function deriveAssistantCurrentStep(text: string) {
  const blockedDataset = extractBlockedDataset(text);
  if (blockedDataset) {
    return `Waiting for ${blockedDataset.id} to become ready.`;
  }
  if (/Started .* run |Started research environment build|Queued /u.test(text)) {
    return "Remote run started and is continuing in the background.";
  }
  return null;
}

function isRunStartPrompt(lower: string) {
  return /\busing\s+[a-z0-9][a-z0-9_-]*\b/u.test(lower)
    && /\b(strict json|bar chart|representative examples|sample \d+|randomly sample)\b/u.test(lower);
}

function isWaitingForUserReply(text: string) {
  return /Waiting for your answer/u.test(text)
    || /Waiting for your approval/u.test(text)
    || /Waiting for your choice/u.test(text)
    || /Waiting for input/u.test(text)
    || /Need one detail to finalize/u.test(text)
    || /Questions needed/u.test(text)
    || /Reply with /u.test(text)
    || /Reply with one choice:/u.test(text)
    || /Send path \+ one-line description/u.test(text)
    || /Send these inputs in one reply:/u.test(text)
    || /Which geography matters most/u.test(text)
    || /I can help with that, but I need 2 things first:/u.test(text)
    || /source-of-truth details before I build anything/u.test(text)
    || /No upload is needed\./u.test(text)
    || /No remote run has started yet\./u.test(text);
}

function isRecoveryPrompt(lower: string) {
  const asksAboutBlockedWork = /\b(blocked|stuck|failed|failure|what is happening|what happened|status|progress)\b/u.test(lower);
  const asksForHelp = /\b(what should i do next|do next|next step|recover|recovery|anything useful|useful was produced|artifacts?)\b/u.test(lower);
  return asksAboutBlockedWork && asksForHelp;
}

function isOrientationPrompt(lower: string) {
  if (/^(what can you help me do\??|help|what do you do\??)$/u.test(lower.trim())) {
    return true;
  }
  if (/\b(just opened|what is this|what should i type first|where should i start|how do i start)\b/u.test(lower)) {
    return true;
  }
  return /\bhow\b.*\b(start|begin)\b/u.test(lower) && /\bresearch\b/u.test(lower);
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
