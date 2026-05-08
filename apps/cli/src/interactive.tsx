import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useApp, useFocus, useInput, useWindowSize } from "ink";
import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  useAui,
  useAuiState,
  useLocalRuntime,
  type ChatModelAdapter,
  type ThreadMessage,
} from "@assistant-ui/react-ink";
import { MarkdownText } from "@assistant-ui/react-ink-markdown";

import { type AgentConversationState, type AgentMessage, runAgentTurn } from "./agent.js";
import { RUN_POLL_INTERVAL_MS, type SessionRecord } from "./config.js";
import {
  applyAgentMessageToTaskState,
  beginInteractiveTask,
  buildLiveSummary,
  cleanUiLine,
  createIdleTaskState,
  extractAuthRecoveryDetails,
  extractBlockedRunDetails,
  splitTrackedRuns,
  wrapText,
  type InteractiveTaskState,
} from "./interactive-state.js";
import { RemoteApiClient } from "./remote.js";
import { readTrackedRuns, type TrackedRunRecord, isTerminalRunStatus, updateTrackedRun } from "./runs.js";
import { clearSession, login, readSession } from "./session.js";

const PROGRESS_RENDER_THROTTLE_MS = 200;

export function composerPlaceholder(session: SessionRecord | null) {
  return session ? "Ask about datasets, runs, or artifacts" : "Ask about datasets, runs, or sign-in";
}

function blockedComposerPlaceholder() {
  return "Choose recovery: inspect, wait, cancel, or retry later";
}

export function authComposerPlaceholder() {
  return "Type /login to sign in";
}

export function emptyStatePromptExamples() {
  return [
    "Show my datasets so I can see what is ready to use.",
    "Create a dataset from /full/path/to/file.csv.",
    "Show the latest run and its artifacts.",
  ];
}

function shortId(value: string, size = 8) {
  return value.length > size ? value.slice(0, size) : value;
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
  const suffix = latest ? ` · ${summarizePrompt(latest, 80)}` : "";
  return `${shortId(run.id)}  ${run.datasetId}  ${run.status}${suffix}`;
}

export function summarizePrompt(prompt: string, maxLength = 96) {
  const cleaned = cleanUiLine(prompt);
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

export function describeRunPhase(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === "booting" || normalized === "queued") {
    return {
      label: "Starting",
      detail: "Accepted and provisioning the remote worker for this run.",
    };
  }
  if (normalized === "running") {
    return {
      label: "Running",
      detail: "Worker is active and still processing the request.",
    };
  }
  if (normalized === "ready" || normalized === "completed" || normalized === "succeeded") {
    return {
      label: "Complete",
      detail: "The run finished and artifacts should be available.",
    };
  }
  if (normalized === "failed" || normalized === "error" || normalized === "worker_unreachable") {
    return {
      label: "Blocked",
      detail: "Remote state is unclear. Inspect the run or retry later.",
    };
  }
  return {
    label: "Needs attention",
    detail: "Check the run for the latest status and next step.",
  };
}

export function describeRunFreshness(updatedAt: string, now = Date.now()) {
  const updatedMs = new Date(updatedAt).getTime();
  if (!Number.isFinite(updatedMs)) {
    return {
      label: "Unknown",
      color: "gray" as const,
      detail: "No reliable heartbeat yet.",
      age: "unknown",
    };
  }
  const ageMs = Math.max(0, now - updatedMs);
  const ageSeconds = Math.round(ageMs / 1000);
  const age = ageSeconds < 60
    ? `${ageSeconds}s ago`
    : ageSeconds < 3600
      ? `${Math.floor(ageSeconds / 60)}m ago`
      : `${Math.floor(ageSeconds / 3600)}h ago`;
  if (ageMs <= 2 * 60_000) {
    return {
      label: "Fresh",
      color: "green" as const,
      detail: "Healthy if another update arrives within 2 minutes.",
      age,
    };
  }
  if (ageMs < 5 * 60_000) {
    return {
      label: "Warm",
      color: "yellow" as const,
      detail: "Still within the normal wait window. Debug if it stays quiet past 5 minutes.",
      age,
    };
  }
  return {
    label: "Stale",
    color: "red" as const,
    detail: "Quiet longer than expected. Inspect or debug now.",
    age,
  };
}

export function describeRunExpectation(run: TrackedRunRecord) {
  const prompt = (run.prompt ?? "").toLowerCase();
  const outputs = [];
  if (/strict json|json/u.test(prompt)) outputs.push("structured JSON");
  if (/chart|bar chart|plot|graph/u.test(prompt)) outputs.push("chart");
  if (/examples?/u.test(prompt)) outputs.push("examples");
  if (/label/u.test(prompt)) outputs.push("labels");
  if (outputs.length === 0) outputs.push("briefing");
  return `Expected outputs: ${outputs.join(", ")}.`;
}

export function formatRunLastUpdate(run: TrackedRunRecord, maxLength = 120) {
  const latest = run.lastEventMessage?.trim();
  if (!latest) {
    return "No remote milestone yet. You can leave this open while the worker continues.";
  }
  return summarizePrompt(latest, maxLength);
}

function summarizeRunActivity(run: TrackedRunRecord) {
  const latest = run.lastEventMessage?.trim();
  if (!latest) {
    return "No remote milestone yet.";
  }
  if (/Remote agent droplet .* launched in /i.test(latest)) {
    return "Worker started and is still getting ready.";
  }
  return summarizePrompt(latest, 100);
}

function collectSectionBullets(text: string, heading: string) {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start === -1) return [] as string[];
  const bullets: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const trimmed = lines[index]?.trim() ?? "";
    if (!trimmed) continue;
    if (!trimmed.startsWith("- ")) break;
    bullets.push(trimmed.slice(2).trim());
  }
  return bullets;
}

export function summarizeCompletedResult(text: string) {
  const selectedRun = text.match(/^Selected the most recent completed run:\s*([^,]+)(?:, completed .+)?\.$/imu)?.[1]?.trim()
    ?? text.match(/^Selected run:\s*(.+)$/imu)?.[1]?.trim()
    ?? text.match(/^- ([^(]+?) \([^)]+\) completed successfully\.$/imu)?.[1]?.trim()
    ?? null;
  const completedAt = text.match(/^Selected the most recent completed run:\s*[^,]+, completed (.+)\.$/imu)?.[1]?.trim()
    ?? text.match(/^Completed:\s*(.+)$/imu)?.[1]?.trim()
    ?? text.match(/completed ([^.]+)\.$/iu)?.[1]?.trim()
    ?? null;
  const why = text.match(/^Why this run:\s*(.+)$/imu)?.[1]?.trim()
    ?? collectSectionBullets(text, "Latest finished result").find((line) => line.startsWith("Why this result:"))?.replace(/^Why this result:\s*/u, "")
    ?? null;
  const summary = collectSectionBullets(text, "Summary")[0]
    ?? collectSectionBullets(text, "What changed")[0]
    ?? null;
  const artifacts = collectSectionBullets(text, "Artifacts")
    .map((line) => line.replace(/^(Open first|Also available):\s*/u, "").split(/[—(]/u)[0]?.trim() ?? "")
    .filter(Boolean)
    .slice(0, 3);

  if (!selectedRun && !summary && !why) {
    return null;
  }

  const headline = selectedRun
    ? `Selected completed run: ${selectedRun}${completedAt ? `, completed ${completedAt.replace(/\.$/u, "")}` : ""}.`
    : "Selected the latest completed run.";

  return { headline, why, summary, artifacts };
}

export function currentWorkSummary(taskState: InteractiveTaskState) {
  const authRecovery = taskState.lastResult ? extractAuthRecoveryDetails(taskState.lastResult) : null;
  if (taskState.status === "blocked" && authRecovery) {
    return {
      title: "Sign-in recovery",
      lines: [
        "You are signed out.",
        "Run `/login` here or `research login` in another terminal to continue.",
        authRecovery.originalRequest ? `Saved request: ${authRecovery.originalRequest}` : null,
      ].filter((line): line is string => Boolean(line)),
    };
  }
  const blockedDetails = taskState.lastResult ? extractBlockedRunDetails(taskState.lastResult) : null;
  if (taskState.status === "blocked" && blockedDetails) {
    return {
      title: "Blocking run",
      lines: [
        blockedDetails.datasetId ? `Dataset: ${blockedDetails.datasetId}` : null,
        blockedDetails.runId ? `Run id: ${blockedDetails.runId}` : null,
        blockedDetails.runStatus ? `Status: ${blockedDetails.runStatus}` : null,
        blockedDetails.expectedDelay ? `Expected delay: ${blockedDetails.expectedDelay}` : null,
        blockedDetails.escalationHint ? `Escalate if: ${blockedDetails.escalationHint}` : null,
      ].filter((line): line is string => Boolean(line)),
    };
  }
  if (taskState.focusRunId) {
    return {
      title: "Current run",
      lines: [
        `Run id: ${taskState.focusRunId}`,
        taskState.selectedDatasetId ? `Dataset: ${taskState.selectedDatasetId}` : null,
        `Status: ${formatTaskStatus(taskState.status)}${taskState.statusLabel ? ` · ${taskState.statusLabel}` : ""}`,
        taskState.focusRunUrl ? `Dashboard: ${taskState.focusRunUrl}` : null,
        taskState.nextExpectedOutput ? `Next: ${taskState.nextExpectedOutput}` : null,
      ].filter((line): line is string => Boolean(line)),
    };
  }

  if (taskState.selectedDatasetId && (taskState.status === "blocked" || taskState.status === "working" || taskState.status === "waiting")) {
    return {
      title: "Current work",
      lines: [
        `Dataset: ${taskState.selectedDatasetId}${taskState.selectedDatasetState ? ` (${taskState.selectedDatasetState})` : ""}`,
        taskState.currentStep ? `State: ${taskState.currentStep}` : null,
        taskState.nextExpectedOutput ? `Next: ${taskState.nextExpectedOutput}` : null,
      ].filter((line): line is string => Boolean(line)),
    };
  }

  return null;
}

export function runPanelSummary(runs: TrackedRunRecord[], focusRunId: string | null = null) {
  const { focused, background } = splitTrackedRuns(runs, focusRunId);
  const visible = [focused, ...background].filter((item): item is TrackedRunRecord => Boolean(item)).slice(0, 3);
  if (visible.length === 0) {
    return ["No active runs."];
  }
  return visible.map((run) => summarizeRunLine(run));
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
      {wrapText(text, Math.max(12, width - 4)).map((line, index) => (
        <Text key={index} backgroundColor="black" color="white">
          {`› ${line}`.padEnd(Math.max(12, width - 1), " ")}
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
      <MarkdownText text={formatAssistantDisplayText(text)} />
    </Box>
  );
}

export function formatAssistantDisplayText(text: string) {
  return formatDatasetSummaryDisplayText(text)
    .replace(/(\bDo you want to:)\s*-\s*/gu, "$1\n\n- ")
    .replace(/(\bWant me to:)\s*-\s*/gu, "$1\n\n- ")
    .replace(/(\bExamples you can send:)\s*-\s*/gu, "$1\n\n- ")
    .replace(/[ \t]+or[ \t]+-[ \t]+(?=[A-Z“"`])/gu, "\n- ")
    .replace(/([,\?])[ \t]+-[ \t]+(?=[A-Z])/gu, "$1\n- ")
    .replace(/[ \t]+-[ \t]+(?=[“"`])/gu, "\n- ");
}

function formatDatasetSummaryDisplayText(text: string) {
  if (!/\b(?:Canonical policy|Coverage \(key raw sources and paths\)|Quality\/provenance|Limitations\/blocks)\b/u.test(text)) {
    return text;
  }

  return text
    .replace(/^(\S*\/(?:datasets|data\/instances)\/[^\s]+)\s+-\s+Size:\s*/u, "$1\n\n**Size:** ")
    .replace(/\s+-\s+Canonical policy:\s*/u, "\n**Canonical policy:** ")
    .replace(/\s+Coverage \(key raw sources and paths\)\s+-\s*/u, "\n\n**Coverage**\n- ")
    .replace(/\s+Quality\/provenance\s+-\s*/u, "\n\n**Quality/provenance**\n- ")
    .replace(/\s+Limitations\/blocks\s+-\s*/u, "\n\n**Limitations/blocks**\n- ")
    .replace(/\s+License-review:\s*/u, "\n- License-review: ")
    .replace(/\s+Runtime tooling present under\s+/u, "\n- Runtime tooling present under ")
    .replace(/\s+Want me to:\s*/u, "\n\nWant me to: ")
    .replace(/[ \t]+-[ \t]+(?=(?:FRED macro|Census microdata|Housing|Income|Global\/finance|Reference|Blocked\/not found|License-review|Runtime tooling)\b)/gu, "\n- ");
}

function ActivityIndicator() {
  const isRunning = useAuiState((state) => state.thread.isRunning);
  if (!isRunning) return null;

  return (
    <Box>
      <Text color="yellow">· working</Text>
    </Box>
  );
}

function formatTaskStatus(status: InteractiveTaskState["status"]) {
  if (status === "done") return "ready";
  return status;
}

function statusBadgeColor(status: InteractiveTaskState["status"]) {
  if (status === "blocked") return "red";
  if (status === "waiting") return "green";
  if (status === "working") return "yellow";
  return "blue";
}

function TaskActivityIndicator({
  status,
  currentStep,
  startedAt,
}: {
  status: InteractiveTaskState["status"];
  currentStep: string | null;
  startedAt: number | null;
}) {
  if (status === "waiting") {
    const waitingLabel = currentStep && /approval|choice/u.test(currentStep)
      ? "· scoping experiment · waiting for your choice"
      : "· waiting for your reply";
    return (
      <Box>
        <Text color="green">{waitingLabel}</Text>
      </Box>
    );
  }
  if (status === "blocked") {
    return (
      <Box>
        <Text color="red">· blocked</Text>
      </Box>
    );
  }
  if (status === "done") {
    return (
      <Box>
        <Text color="green">· ready for the next question</Text>
      </Box>
    );
  }
  if (status === "working") {
    return (
      <Box>
        <Text color="yellow">{`· working${currentStep ? ` · ${currentStep}` : ""}`}</Text>
      </Box>
    );
  }
  return <ActivityIndicator />;
}

function TaskSummary({
  taskState,
  width,
  conversationState,
  showRequestSummary,
}: {
  taskState: InteractiveTaskState;
  width: number;
  conversationState: AgentConversationState;
  showRequestSummary: boolean;
}) {
  const preview = summarizePrompt(taskState.goal ?? "", 140);
  const resolvedDataset = conversationState.datasetContext?.lastResolvedDataset;
  const workSummary = currentWorkSummary(taskState);
  const authRecovery = taskState.status === "blocked" && taskState.lastResult ? extractAuthRecoveryDetails(taskState.lastResult) : null;
  const blockedDetails = taskState.status === "blocked" && taskState.lastResult ? extractBlockedRunDetails(taskState.lastResult) : null;
  const blockedBannerColor = blockedDetails?.recommendedAction === "wait" ? "yellow" : "red";
  const summaryBorderColor = authRecovery ? "yellow" : taskState.status === "blocked" ? blockedBannerColor : "green";

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={summaryBorderColor} paddingX={1}>
      <Text bold color={summaryBorderColor}>research</Text>
      <Text>{`Status: ${formatTaskStatus(taskState.status)}`}</Text>
      {taskState.statusLabel ? <Text color={statusBadgeColor(taskState.status)}>{`State: ${taskState.statusLabel}`}</Text> : null}
      {resolvedDataset ? <Text color="cyan">{`Context: ${resolvedDataset.id} (${resolvedDataset.scope} · ${resolvedDataset.state})`}</Text> : null}
      {showRequestSummary && preview ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Goal</Text>
          {wrapText(preview, Math.max(24, width - 6)).slice(0, 2).map((line, index) => (
            <Text key={index}>{line}</Text>
          ))}
        </Box>
      ) : null}
      {taskState.currentStep && taskState.status !== "blocked" ? <Text>{`${taskState.status === "done" ? "Last step" : "Current step"}: ${taskState.currentStep}`}</Text> : null}
      {authRecovery ? (
        <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor="yellow" paddingX={1}>
          <Text bold color="yellow">Sign in required</Text>
          <Text>You are signed out, so I cannot access remote datasets yet.</Text>
          <Text>Run `/login` here or `research login` in another terminal.</Text>
          {authRecovery.originalRequest ? <Text>{`After sign-in, I can resume: ${authRecovery.originalRequest}`}</Text> : null}
        </Box>
      ) : null}
      {blockedDetails ? (
        <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor={blockedBannerColor} paddingX={1}>
          <Text bold color={blockedBannerColor}>Dataset locked by active run</Text>
          <Text>{`No new run was started for ${blockedDetails.datasetId ?? taskState.selectedDatasetId ?? "this dataset"}.`}</Text>
          {blockedDetails.currentWork ? <Text>{`Current work: ${blockedDetails.currentWork}`}</Text> : null}
          {blockedDetails.recommendedAction ? <Text>{`Recommended action: ${blockedDetails.recommendedAction.replace("_", " ")}`}</Text> : null}
        </Box>
      ) : null}
      {taskState.lastResult && taskState.status === "done" ? (() => {
        const resultSummary = summarizeCompletedResult(taskState.lastResult);
        if (!resultSummary) return null;
        return (
          <Box flexDirection="column" marginTop={1}>
            <Text bold>Result</Text>
            <Text>{resultSummary.headline}</Text>
            {resultSummary.why ? <Text>{`Why this run: ${resultSummary.why}`}</Text> : null}
            {resultSummary.summary ? <Text>{`Summary: ${resultSummary.summary}`}</Text> : null}
            {resultSummary.artifacts.length > 0 ? <Text>{`Artifacts: ${resultSummary.artifacts.join(", ")}`}</Text> : null}
          </Box>
        );
      })() : null}
      {taskState.nextExpectedOutput && !workSummary && !blockedDetails ? <Text>{`Next expected output: ${taskState.nextExpectedOutput}`}</Text> : null}
      {workSummary ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>{workSummary.title}</Text>
          {workSummary.lines.map((line) => (
            <Text key={line}>{line}</Text>
          ))}
        </Box>
      ) : null}
      {authRecovery ? null : blockedDetails ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Recovery actions</Text>
          <Text>{`1. Inspect now${blockedDetails.debugCommand ? `: ${blockedDetails.debugCommand}` : ""}`}</Text>
          <Text>{`2. Wait${blockedDetails.expectedDelay ? `: ${blockedDetails.expectedDelay}` : ": this is normal while the worker starts."}`}</Text>
          <Text>{`3. Cancel: stop the blocking run if it is truly stuck.`}</Text>
          <Text>4. Retry later: rerun this request after the lock clears.</Text>
          {blockedDetails.dashboardUrl ? <Text color="gray">Dashboard link available after inspect.</Text> : null}
        </Box>
      ) : taskState.planSteps.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Plan</Text>
          {taskState.planSteps.map((step, index) => (
            <Text key={step}>{`${index + 1}. ${step}`}</Text>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

function IdleSummary({
  session,
  runs,
  startupComplete,
  width,
}: {
  session: SessionRecord | null;
  runs: TrackedRunRecord[];
  startupComplete: boolean;
  width: number;
}) {
  const activeRunLines = runPanelSummary(runs);
  const examples = emptyStatePromptExamples();

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="blue" paddingX={1}>
      <Text bold color="blue">research</Text>
      <Text>Dataset-backed research agent for choosing, building, inspecting, and running research on datasets.</Text>
      <Text color={startupComplete ? "gray" : "yellow"}>
        {startupComplete ? "Waiting for your prompt." : "Starting up and checking for active runs..."}
      </Text>
      <Box flexDirection="column" marginTop={1}>
        <Text bold>Active runs</Text>
        {activeRunLines.map((line) => (
          <Text key={line}>{line}</Text>
        ))}
      </Box>
      <Box flexDirection="column" marginTop={1}>
        <Text bold>Try one of these</Text>
        {examples.map((example) => (
          <Text key={example}>{`- ${example}`}</Text>
        ))}
      </Box>
      <Box flexDirection="column" marginTop={1}>
        <Text bold>Input</Text>
        {wrapText("Type a question and press Enter. Use /login when you need account datasets or cloud-backed runs.", Math.max(24, width - 6)).map((line, index) => (
          <Text key={`${line}-${index}`}>{line}</Text>
        ))}
        {!session ? <Text color="gray">Signed out locally. You can still ask local dataset and run questions.</Text> : null}
      </Box>
    </Box>
  );
}

function RunStatusPanel({
  runs,
  focusRunId,
}: {
  runs: TrackedRunRecord[];
  focusRunId: string | null;
}) {
  const now = Date.now();
  const { focused, background } = useMemo(() => splitTrackedRuns(runs, focusRunId), [focusRunId, runs]);

  const freshness = focused ? describeRunFreshness(focused.updatedAt, now) : null;
  const phase = focused ? describeRunPhase(focused.status) : null;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={freshness?.color ?? "gray"} paddingX={1}>
      <Text bold>Active run</Text>
      {focused ? (
        <>
          <Text>{`${shortId(focused.id)} · ${focused.datasetId}`}</Text>
          <Text color={runStatusColor(focused.status)}>{`State: ${phase?.label ?? focused.status} (${focused.status})`}</Text>
          <Text color={freshness?.color}>{`Freshness: ${freshness?.label ?? "Unknown"} · last heartbeat ${freshness?.age ?? "unknown"}`}</Text>
          <Text color="gray">{phase?.detail}</Text>
          <Text color="gray">{`Current activity: ${summarizeRunActivity(focused)}`}</Text>
          <Text color="gray">{freshness?.detail}</Text>
          <Text color="gray">{focused.dashboardUrl ? "Actions: w wait · i inspect · d debug · c cancel" : "Actions: w wait · d debug · c cancel"}</Text>
        </>
      ) : <Text>No active runs.</Text>}
      {focused && background.length > 0 ? (
        <>
          <Text color="gray">{background.length === 1 ? "1 other active run hidden." : `${background.length} other active runs hidden.`}</Text>
        </>
      ) : null}
    </Box>
  );
}

function ResearchThread({
  trackedRuns,
  taskState,
  session,
  startupComplete,
  conversationState,
}: {
  trackedRuns: TrackedRunRecord[];
  taskState: InteractiveTaskState;
  session: SessionRecord | null;
  startupComplete: boolean;
  conversationState: AgentConversationState;
}) {
  const { columns } = useWindowSize();
  const isRunning = useAuiState((state) => state.thread.isRunning);
  const messageCount = useAuiState((state) => state.thread.messages.length);
  const borderColor = taskState.status === "blocked" ? "gray" : taskState.status === "waiting" ? "green" : isRunning ? "yellow" : "blue";
  const promptColor = taskState.status === "blocked" ? "yellow" : taskState.status === "waiting" ? "green" : isRunning ? "yellow" : "blue";
  const inputWidth = Math.max(20, columns - 4);
  const showIdleSummary = messageCount === 0 && !taskState.goal;
  const authRecovery = taskState.status === "blocked" && taskState.lastResult ? extractAuthRecoveryDetails(taskState.lastResult) : null;
  const showThreadMessages = showIdleSummary || taskState.status === "done" || (messageCount > 1 && taskState.status !== "blocked");
  const showRequestSummary = !showThreadMessages;

  return (
    <ThreadPrimitive.Root>
      {showIdleSummary ? (
        <IdleSummary session={session} runs={trackedRuns} startupComplete={startupComplete} width={columns} />
      ) : (
        <TaskSummary taskState={taskState} width={columns} conversationState={conversationState} showRequestSummary={showRequestSummary} />
      )}

      {showThreadMessages ? (
        <ThreadPrimitive.Messages>
          {({ message }) =>
            message.role === "user" ? (
              <UserMessage width={Math.max(20, columns - 1)} />
            ) : (
              <AssistantMessage />
            )
          }
        </ThreadPrimitive.Messages>
      ) : null}

      <TaskActivityIndicator status={taskState.status} currentStep={taskState.currentStep} startedAt={taskState.startedAt} />
      {taskState.activity.length > 0
      && !authRecovery
      && taskState.status !== "done"
      && taskState.status !== "blocked"
      && !taskState.activity.every((item) => item === taskState.lastResult)
      && !(taskState.status !== "working" && taskState.activity.length === 1) ? (
        <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1}>
          <Text bold>Recent progress</Text>
          {taskState.activity.map((item) => (
            <Text key={item}>{`· ${item}`}</Text>
          ))}
        </Box>
      ) : null}
      {!showIdleSummary && taskState.focusRunId && !authRecovery ? <RunStatusPanel runs={trackedRuns} focusRunId={taskState.focusRunId} /> : null}

      <Box flexDirection="column">
        <Text bold color={promptColor}>
          {taskState.status === "blocked" ? "Recovery reply" : messageCount > 0 ? (taskState.status === "done" ? "Reply" : "Reply in thread") : "Prompt"}
        </Text>
        <Text color="gray">
          {taskState.status === "blocked"
            ? authRecovery
              ? "Type `/login` to sign in, or sign in in another terminal and then retry your request."
              : "Type `inspect`, `wait`, `cancel`, or `retry later`, then press Enter."
            : taskState.status === "done"
              ? "Ready. Type another question and press Enter."
              : "Type a follow-up or command and press Enter."}
        </Text>
        <Box borderStyle="round" borderColor={borderColor} paddingX={1} width={inputWidth}>
          <Text color={promptColor}>{"> "}</Text>
          <StableComposerInput key={`${messageCount}:${taskState.status}`} submitOnEnter placeholder={taskState.status === "blocked" ? (authRecovery ? authComposerPlaceholder() : blockedComposerPlaceholder()) : composerPlaceholder(session)} autoFocus />
        </Box>
      </Box>
    </ThreadPrimitive.Root>
  );
}

function StableComposerInput({
  submitOnEnter,
  placeholder,
  autoFocus = true,
}: {
  submitOnEnter?: boolean;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const aui = useAui();
  const { exit } = useApp();
  const [draft, setDraft] = useState("");
  const { isFocused } = useFocus({ autoFocus });

  useInput(
    (input, key) => {
      if ((key.ctrl || key.meta) && input === "c") {
        if (draft.length > 0) {
          setDraft("");
        } else {
          exit();
        }
        return;
      }
      if (key.return) {
        if (submitOnEnter) {
          aui.composer().setText(draft);
          aui.composer().send();
          setDraft("");
        }
        return;
      }
      if (key.backspace || key.delete) {
        setDraft((value) => value.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setDraft((value) => value + input);
      }
    },
    { isActive: isFocused },
  );

  return (
    <Box>
      <Text dimColor={!draft && !!placeholder}>{draft || placeholder}</Text>
      {isFocused ? <Text>▋</Text> : null}
    </Box>
  );
}

function RunPoller({
  session,
  setTrackedRuns,
}: {
  session: SessionRecord | null;
  setTrackedRuns: (runs: TrackedRunRecord[]) => void;
}) {
  useEffect(() => {
    if (!session) {
      return undefined;
    }

    let cancelled = false;
    const emit = (_message: AgentMessage) => {};

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
  }, [session, setTrackedRuns]);

  return null;
}

function createResearchAdapter({
  exit,
  sessionRef,
  setSession,
  conversationStateRef,
  setConversationState,
  setTrackedRuns,
  setTaskState,
}: {
  exit: () => void;
  sessionRef: React.MutableRefObject<SessionRecord | null>;
  setSession: (session: SessionRecord | null) => void;
  conversationStateRef: React.MutableRefObject<AgentConversationState>;
  setConversationState: (state: AgentConversationState) => void;
  setTrackedRuns: (runs: TrackedRunRecord[]) => void;
  setTaskState: (state: InteractiveTaskState | ((current: InteractiveTaskState) => InteractiveTaskState)) => void;
}): ChatModelAdapter {
  return {
    async *run({ messages, abortSignal }) {
      const prompt = textFromThreadMessage(messages.filter((message) => message.role === "user").at(-1));
      let liveTaskState = createIdleTaskState();
      let visibleText = "";
      let changed = false;
      let lastYieldedText = "";
      let lastYieldedAt = 0;
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
        liveTaskState = applyAgentMessageToTaskState(liveTaskState, message);
        setTaskState(liveTaskState);
        const nextVisibleText = message.role === "assistant"
          ? cleanUiLine(message.content)
          : buildLiveSummary(liveTaskState);
        if (nextVisibleText === visibleText) {
          return;
        }
        if (message.role === "assistant") {
          visibleText = nextVisibleText;
        } else {
          visibleText = nextVisibleText;
        }
        markChanged();
      };
      const flush = function* () {
        lastYieldedText = visibleText || " ";
        lastYieldedAt = Date.now();
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
            const nextText = visibleText || " ";
            const now = Date.now();
            if (nextText !== lastYieldedText && now - lastYieldedAt >= PROGRESS_RENDER_THROTTLE_MS) {
              lastYieldedText = nextText;
              lastYieldedAt = now;
              yield { content: assistantContent(nextText) };
            }
          }
          if (result === "done") {
            break;
          }
          if (abortSignal.aborted) {
            break;
          }
        }
        await task;
        const finalText = visibleText || " ";
        if (finalText !== lastYieldedText) {
          lastYieldedText = finalText;
          lastYieldedAt = Date.now();
          yield { content: assistantContent(finalText) };
        }
      }

      if (!prompt) {
        setTaskState(createIdleTaskState());
        visibleText = "What would you like to do?";
        yield* flush();
        return;
      }

      liveTaskState = beginInteractiveTask(prompt);
      setTaskState(liveTaskState);

      if (prompt === "/quit" || prompt === "/exit") {
        setTaskState(createIdleTaskState());
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
            const resetState = { sessionId: null, previousResponseId: null, datasetContext: null };
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
        const resetState = { sessionId: null, previousResponseId: null, datasetContext: null };
        conversationStateRef.current = resetState;
        setConversationState(resetState);
        setTaskState(createIdleTaskState());
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
            setTaskState((current) => ({
              ...current,
              status: "blocked",
              lastResult: "No active tracked run to cancel.",
            }));
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
          setTaskState((current) => ({
            ...current,
            status: "done",
            lastResult: `Cancelled run ${targetRunId}.`,
            focusRunId: targetRunId,
          }));
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
            visibleText = liveTaskState.lastResult ?? "done.";
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

export function InteractiveApp() {
  const { exit } = useApp();
  const [session, setSessionState] = useState<SessionRecord | null>(null);
  const [trackedRuns, setTrackedRuns] = useState<TrackedRunRecord[]>([]);
  const [taskState, setTaskState] = useState<InteractiveTaskState>(createIdleTaskState());
  const [startupComplete, setStartupComplete] = useState(false);
  const [conversationState, setConversationStateState] = useState<AgentConversationState>({
    sessionId: null,
    previousResponseId: null,
    datasetContext: null,
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

  useInput((_value, key) => {
    if (key.escape) {
      exit();
    }
  });

  useEffect(() => {
    void Promise.all([
      readSession().then(setSession),
      readTrackedRuns().then((runs) => {
        setTrackedRuns(runs);
      }),
    ]).finally(() => {
      setStartupComplete(true);
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
        setTaskState,
      }),
    [exit],
  );
  const runtime = useLocalRuntime(adapter);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Box flexDirection="column">
        <ResearchThread
          trackedRuns={trackedRuns}
          taskState={taskState}
          session={session}
          startupComplete={startupComplete}
          conversationState={conversationState}
        />
        <RunPoller session={session} setTrackedRuns={setTrackedRuns} />
      </Box>
    </AssistantRuntimeProvider>
  );
}
