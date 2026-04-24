import { access, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";

import { getInstanceBootstrap, listInstanceBundles } from "@alpha-datasets/storage";

import { DEFAULT_INSTANCE_ROOT, DEFAULT_WEB_ORIGIN, dashboardRunUrl, dashboardTerminalSessionUrl, type SessionRecord } from "./config.js";
import { inferDatasetDefaults, inferDatasetIngestFlags, inspectLocalDatasetFile, uploadFileToPresignedUrl } from "./local-tools.js";
import { RemoteApiClient, RemoteRequestError } from "./remote.js";
import { readSession, login } from "./session.js";
import { isTerminalRunStatus, readTrackedRuns, spawnRunWatcher, trackRemoteRun } from "./runs.js";

export type AgentMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

type AgentToolResult = {
  summary: string;
  data?: unknown;
};

type JsonSchema = Record<string, unknown>;

type ToolExecutionContext = {
  session: SessionRecord | null;
  sessionId: string | null;
  emit: (message: AgentMessage) => void;
};

export type AgentConversationState = {
  sessionId: string | null;
  previousResponseId: string | null;
};

type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  execute: (context: ToolExecutionContext, input: Record<string, unknown>) => Promise<AgentToolResult>;
};

type ResponseFunctionCall = {
  type: "function_call";
  call_id?: string;
  name?: string;
  arguments?: string;
};

type ResponseMessage = {
  type?: string;
  content?: Array<{
    type?: string;
    text?: string;
  }>;
};

type ResponsesApiPayload = {
  id?: string;
  output_text?: string;
  output?: Array<ResponseFunctionCall | ResponseMessage | Record<string, unknown>>;
};

const DATASET_EXTENSIONS = [".parquet", ".csv", ".json", ".txt", ".md", ".markdown", ".html", ".htm", ".pdf"];
const MAX_TOOL_ROUNDS = 12;
const ASYNC_RUN_START_TOOLS = new Set([
  "start_remote_run",
  "query_remote_dataset",
  "aggregate_remote_dataset",
  "fetch_public_data",
  "start_remote_agent_run",
  "continue_remote_agent_run",
  "run_remote_transformation",
  "run_remote_labeling",
  "create_public_data_environment",
  "create_research_environment",
]);

const AGENT_INSTRUCTIONS = [
  "You are RESEARCH, a CLI agent for helping knowledge workers work faster.",
  "You help them by creating and managing remote research environments with large datasets, designing experiments, and getting the results.",
  "You manage the creation, operation, and prompting of other agents on remote cloud environments.",
  "",
  "Users will use you in two main ways.",
  "",
  "The first category is creating personal research environments.",
  "The most important thing is to get the right data into that environment.",
  "Some of it will be local, some of it will be public data on the internet, and some of it will require scripting and labeling.",
  "Once you have set up a cloud environment, feel free to prompt AI agents on that environment to help you get the data.",
  "Your goal during environment creation is to get a copy of all the data you need on there.",
  "",
  "The second category is doing research over an existing research environment.",
  "Research is driven by hypotheses.",
  "When the user wants to test a hypothesis, make sure to get enough information to decide:",
  "1. What research environment to run it on.",
  "2. Whether all the necessary data exists in that research environment.",
  "3. If not, whether to extend the research environment to get the necessary data, or alter the plan so the data we do have works.",
  "4. What subset of the dataset to use, what shape it needs to be, whether it is already structured correctly, or whether a script is needed to get the right structure.",
  "5. Whether that script involves using an LLM to label data points, and what prompt to give that LLM call.",
  "6. How to view the results of the experiment. Be precise. If there are graphs, specify the chart type and exactly what the axes are.",
  "",
  "Use the provided tools.",
  "For new environments that involve public internet/API sources, private/local files, paid exports, or any mix of sources, prefer create_research_environment.",
  "Use create_public_data_environment only for simple public-only environments. Do not use deploy_remote_dataset unless there is one uploaded/local source that only needs normalization.",
  "For environment creation, make a concrete acquisition plan in the remote prompt: public sources, private files, APIs, files to fetch, normalized output tables, manifest, and validation checks.",
  "Prefer lightweight dataset queries before launching heavy transforms or analyses when the user is asking for examples, top records, or simple slices.",
  "Do not answer with generic numbered menus when you can inspect the user's actual datasets or runs and propose one concrete next action.",
  "When you start a remote run, do not wait for completion unless the user explicitly asks you to wait. Return immediately with the run id and dashboard link.",
  "When the user asks for run results, render them as a concise human-readable report. Do not dump raw JSON unless explicitly asked.",
  "For run results, explain artifacts as saved run outputs and tell the user to view them on the run page.",
  "For completed runs, give 2-3 concrete follow-up suggestions grounded in the result.",
  "For uploaded-file deployment flows, prefer this sequence:",
  "1. resolve_local_dataset",
  "2. register_remote_dataset",
  "3. request_dataset_source_upload",
  "4. upload_local_file",
  "5. complete_dataset_source_upload",
  "6. deploy_remote_dataset",
  "Be concise. After tool work completes, summarize the result and current status.",
  "Only ask the user a question if a required tool input cannot be resolved from tools or prior results.",
].join("\n");

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatStatusForHumans(status: string | undefined) {
  const normalized = (status ?? "").toLowerCase();
  if (normalized === "ready") return "completed successfully";
  if (normalized === "completed") return "completed successfully";
  if (normalized === "running") return "running";
  if (normalized === "booting") return "booting";
  if (normalized === "queued") return "queued";
  if (normalized === "failed") return "failed";
  if (normalized === "cancelled" || normalized === "canceled") return "cancelled";
  return status ?? "unknown";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProducedArtifact(artifact: { type?: string }) {
  return artifact.type !== "requested_artifact" && artifact.type !== "remote_agent_session";
}

function artifactBullet(artifact: { title?: string; type?: string }) {
  const title = typeof artifact.title === "string" && artifact.title.trim() ? artifact.title.trim() : artifact.type ?? "artifact";
  if (artifact.type === "structured_result" || title === "result.json") {
    return `${title} — structured result data`;
  }
  if (artifact.type === "remote_agent_summary") {
    return `${title} — short written summary from the remote run`;
  }
  if (artifact.type === "remote_agent_transcript") {
    return `${title} — full remote execution log`;
  }
  if (title.endsWith(".md")) {
    return `${title} — markdown summary/report`;
  }
  return title;
}

function findStructuredResultArtifact(artifacts: Array<{ title?: string; type?: string; content?: unknown }>) {
  return artifacts.find((artifact) => artifact.type === "structured_result" && isRecord(artifact.content))
    ?? artifacts.find((artifact) => artifact.title === "result.json" && isRecord(artifact.content));
}

function inferFollowUpSuggestions(
  datasetId: string,
  result: Record<string, unknown> | null,
): string[] {
  const suggestions: string[] = [];
  if (!result) {
    return [
      `Open the run page for ${datasetId} and inspect the produced artifacts.`,
      `Ask for a narrower follow-up analysis on ${datasetId}.`,
    ];
  }
  if ("created_at_min" in result || "created_at_max" in result || "monthly_counts" in result) {
    suggestions.push("Trend tweet volume over time and highlight spikes by month.");
  }
  if ("top_usernames" in result || "top_accounts" in result) {
    suggestions.push("Profile the top accounts and compare engagement or posting patterns.");
  }
  if ("duplicate_tweet_rows" in result || "distinct_tweet_ids" in result) {
    suggestions.push("Inspect duplicate tweet IDs and verify whether deduplication is needed before deeper analysis.");
  }
  if ("quote_rows" in result || "quote_share" in result || datasetId.includes("tweet")) {
    suggestions.push("Find the most-quoted or highest-engagement tweets and inspect why they spread.");
  }
  return [...new Set(suggestions)].slice(0, 3);
}

function renderStructuredResult(result: Record<string, unknown>) {
  const lines: string[] = [];
  const rowCount = typeof result.total_rows === "number" ? formatNumber(result.total_rows) : null;
  const distinctTweetIds = typeof result.distinct_tweet_ids === "number" ? formatNumber(result.distinct_tweet_ids) : null;
  const duplicateRows = typeof result.duplicate_tweet_rows === "number" ? formatNumber(result.duplicate_tweet_rows) : null;
  const createdAtMin = typeof result.created_at_min === "string" ? result.created_at_min : null;
  const createdAtMax = typeof result.created_at_max === "string" ? result.created_at_max : null;
  if (rowCount || distinctTweetIds || duplicateRows || createdAtMin || createdAtMax) {
    lines.push("Key results");
    if (rowCount) lines.push(`- Rows: ${rowCount}`);
    if (distinctTweetIds) lines.push(`- Distinct tweet IDs: ${distinctTweetIds}`);
    if (duplicateRows) lines.push(`- Duplicate tweet rows: ${duplicateRows}`);
    if (createdAtMin || createdAtMax) lines.push(`- Date range: ${createdAtMin ?? "unknown"} to ${createdAtMax ?? "unknown"}`);
  }
  const topUsernames = Array.isArray(result.top_usernames) ? result.top_usernames : [];
  if (topUsernames.length > 0) {
    lines.push("", "Top usernames");
    for (const entry of topUsernames.slice(0, 5)) {
      if (!isRecord(entry)) continue;
      const username = typeof entry.username === "string" ? entry.username : "unknown";
      const count = typeof entry.row_count === "number" ? formatNumber(entry.row_count) : String(entry.row_count ?? "unknown");
      lines.push(`- ${username}: ${count}`);
    }
  }
  const dataQuality: string[] = [];
  if (typeof result.missing_tweet_id_rows === "number") dataQuality.push(`Missing tweet IDs: ${formatNumber(result.missing_tweet_id_rows)}`);
  if (typeof result.missing_username_rows === "number") dataQuality.push(`Missing usernames: ${formatNumber(result.missing_username_rows)}`);
  if (typeof result.missing_created_rows === "number") dataQuality.push(`Missing timestamps: ${formatNumber(result.missing_created_rows)}`);
  if (dataQuality.length > 0) {
    lines.push("", "Data quality");
    for (const line of dataQuality) {
      lines.push(`- ${line}`);
    }
  }
  if (lines.length === 0) {
    lines.push("Structured result", `- ${JSON.stringify(result)}`);
  }
  return lines.join("\n");
}

function summarizeRunResultsForHumans(
  payload: {
    run: { id: string; datasetId: string; status: string; prompt?: string };
    artifacts: Array<{ title?: string; type?: string; content?: unknown }>;
  },
  origin: string,
) {
  const producedArtifacts = payload.artifacts.filter(isProducedArtifact);
  const resultArtifact = findStructuredResultArtifact(producedArtifacts);
  const structuredResult = resultArtifact?.content && isRecord(resultArtifact.content) ? resultArtifact.content : null;
  const lines = [
    "Last completed run",
    `${payload.run.id} · ${payload.run.datasetId} · ${formatStatusForHumans(payload.run.status)}`,
  ];
  const prompt = payload.run.prompt?.trim();
  if (prompt) {
    lines.push("", "Original request", prompt);
  }
  if (structuredResult) {
    lines.push("", renderStructuredResult(structuredResult));
  }
  if (producedArtifacts.length > 0) {
    lines.push(
      "",
      "Artifacts",
      "Artifacts are the saved outputs from the run. Open them on the run page:",
      ...producedArtifacts.map((artifact) => `- ${artifactBullet(artifact)}`),
    );
  }
  lines.push("", "Dashboard", dashboardRunUrl(origin, payload.run.id));
  const suggestions = inferFollowUpSuggestions(payload.run.datasetId, structuredResult);
  if (suggestions.length > 0) {
    lines.push("", "Suggested follow-ups", ...suggestions.map((suggestion) => `- ${suggestion}`));
  }
  return lines.join("\n");
}

function shouldExposeWaitTool(input: string) {
  const lower = input.toLowerCase();
  return /\b(wait|watch|follow|monitor|stay on|block until|until complete|until it finishes|keep checking)\b/.test(lower);
}

function shouldExposeRunInspectionTools(input: string) {
  const lower = input.toLowerCase();
  return /\b(status|results?|artifacts?|progress|check on|check status|inspect run|what happened|dashboard|open run|monitor|watch|follow)\b/.test(lower);
}

function looksLikeIncompleteTask(input: string) {
  const normalized = input.trim().toLowerCase();
  return /(?:^|\s)(?:then|and|so)\s*(?:\.{2,}|…)\s*$/.test(normalized);
}

function shouldStartFreshConversation(input: string) {
  const lower = input.trim().toLowerCase();
  if (lower.length < 80) {
    return false;
  }
  return (
    /\b(?:here'?s what i want you to do|make me|create|build|set up|kick off|start)\b/.test(lower)
    && /\b(?:dataset|environment|run|analysis|experiment)\b/.test(lower)
  );
}

function looksLikeAuthError(error: unknown) {
  return error instanceof RemoteRequestError && error.status === 401;
}

function parseRemoteErrorJson(error: RemoteRequestError) {
  const match = error.message.match(/(\{[\s\S]*\})\s*$/);
  if (!match?.[1]) {
    return null;
  }
  try {
    return JSON.parse(match[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function summarizeBusyDatasetConflict(error: RemoteRequestError) {
  if (error.status !== 409) {
    return null;
  }
  const payload = parseRemoteErrorJson(error);
  if (!payload || typeof payload.error !== "string" || !payload.error.includes("active run holding its volume")) {
    return null;
  }
  const activeRuns = Array.isArray(payload.activeRuns) ? payload.activeRuns as Array<Record<string, unknown>> : [];
  const first = activeRuns[0];
  if (!first) {
    return payload.error;
  }
  const runId = typeof first.id === "string" ? first.id : "unknown";
  const status = typeof first.status === "string" ? first.status : "running";
  return `Dataset is already busy with run ${runId} (${status}). Open ${dashboardRunUrl(DEFAULT_WEB_ORIGIN, runId)} or ask me to check that run instead of starting another one.`;
}

async function withAuthRetry<T>(
  context: ToolExecutionContext,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (!looksLikeAuthError(error)) {
      throw error;
    }
    const refreshed = await readSession();
    if (refreshed?.accessToken && refreshed.accessToken !== context.session?.accessToken) {
      context.session = refreshed;
      return fn();
    }
    context.emit({ role: "tool", content: "Session expired. Opening login to refresh authentication." });
    const session = await login({}, (message) => {
      context.emit({ role: "tool", content: message });
    });
    context.session = session;
    return fn();
  }
}

async function persistSessionEntry(context: ToolExecutionContext, entry: {
  role: "assistant" | "tool" | "user";
  kind: string;
  title?: string;
  content: string;
  metadata?: unknown;
}) {
  if (!context.session || !context.sessionId || !entry.content.trim()) {
    return;
  }
  try {
    const client = new RemoteApiClient(context.session);
    await client.appendSessionEntry(context.sessionId, entry);
  } catch {
    // Keep the local CLI responsive even if session persistence is unavailable.
  }
}

async function waitForRunCompletion(
  client: RemoteApiClient,
  runId: string,
  emit?: (message: AgentMessage) => void,
  timeoutMs = 180_000,
) {
  const startedAt = Date.now();
  let after: string | undefined;
  let delayMs = 1500;
  let artifactCount = 0;

  while (Date.now() - startedAt < timeoutMs) {
    const eventPayload = await client.getRunEvents(runId, after).catch(() => null);
    if (eventPayload?.events?.length) {
      for (const event of eventPayload.events) {
        emit?.({ role: "tool", content: `[run ${runId}] ${event.message}` });
      }
      after = eventPayload.events[eventPayload.events.length - 1]?.id ?? after;
    }

    const resultPayload = await client.getRunResults(runId).catch(() => null);
    if (resultPayload) {
      artifactCount = resultPayload.artifacts.length;
      if (isTerminalRunStatus(resultPayload.run.status)) {
        return {
          complete: true,
          run: resultPayload.run,
          artifacts: resultPayload.artifacts,
          events: resultPayload.events,
          metadata: resultPayload.metadata,
        };
      }
    } else {
      const runPayload = await client.getRun(runId).catch(() => null);
      if (runPayload?.run && isTerminalRunStatus(runPayload.run.status)) {
        return {
          complete: true,
          run: runPayload.run,
          artifacts: [],
          events: [],
          metadata: null,
        };
      }
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
    delayMs = Math.min(delayMs + 1000, 8000);
  }

  const latestRun = await client.getRun(runId).catch(() => null);
  return {
    complete: false,
    run: latestRun?.run ?? null,
    artifacts: artifactCount > 0 ? [{ pending: true }] : [],
    events: [],
    metadata: null,
  };
}

async function fileExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function inferLocalDatasetPath(input: string): Promise<string | null> {
  const lower = input.toLowerCase();
  const quotedPathMatch = input.match(/"([^"]+\.(parquet|csv|json|txt|md|markdown|html|htm|pdf))"/iu);
  if (quotedPathMatch?.[1]) {
    return quotedPathMatch[1];
  }

  const explicitFilenameMatch = input.match(/([A-Za-z0-9 _-]+\.(parquet|csv|json|txt|md|markdown|html|htm|pdf))/iu);
  if (explicitFilenameMatch?.[1]) {
    const explicitName = explicitFilenameMatch[1].trim();
    const candidates = [
      explicitName,
      join(homedir(), "Downloads", explicitName),
      join(homedir(), "Desktop", explicitName),
    ];
    for (const candidate of candidates) {
      if (await fileExists(candidate)) {
        return candidate;
      }
    }
  }

  const mentionsDownloads = /downloads?/.test(lower);
  const mentionsDesktop = /desktop/.test(lower);
  const directory = mentionsDesktop ? join(homedir(), "Desktop") : join(homedir(), "Downloads");
  const wantsDataset = /dataset|file|parquet|csv|json|pdf|tweets?|text|download/.test(lower);
  if (!wantsDataset) {
    return null;
  }

  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => DATASET_EXTENSIONS.some((extension) => name.toLowerCase().endsWith(extension)));

    if (files.length === 0) {
      return null;
    }

    const scored = files
      .map((name) => {
        let score = 0;
        const normalized = name.toLowerCase();
        if (lower.includes("tweet") && normalized.includes("tweet")) score += 5;
        if (lower.includes("parquet") && normalized.endsWith(".parquet")) score += 4;
        if (lower.includes("enriched") && normalized.includes("enriched")) score += 3;
        if (mentionsDownloads) score += 1;
        return { name, score };
      })
      .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));

    const best = scored[0];
    if (!best) {
      return null;
    }
    if (best.score <= 0 && lower.includes("tweet")) {
      return null;
    }
    return join(directory, best.name);
  } catch {
    return null;
  }
}

function inferModeFromPath(path: string): "tabular" | "unstructured" {
  const lower = path.toLowerCase();
  if (lower.endsWith(".parquet") || lower.endsWith(".csv") || lower.endsWith(".json")) {
    return "tabular";
  }
  return "unstructured";
}

function requireSession(context: ToolExecutionContext) {
  if (!context.session) {
    throw new Error("You need to sign in first. Run `research login`.");
  }
  return context.session;
}

function createRemoteClient(context: ToolExecutionContext) {
  return new RemoteApiClient(requireSession(context));
}

function parseJsonArguments(rawArguments: string | undefined) {
  if (!rawArguments || !rawArguments.trim()) {
    return {};
  }
  try {
    const parsed = JSON.parse(rawArguments);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through
  }
  throw new Error(`Invalid tool arguments: ${rawArguments}`);
}

function extractOutputText(payload: ResponsesApiPayload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const messageTexts = (payload.output ?? [])
    .filter((item): item is ResponseMessage => typeof item === "object" && item !== null && (item as ResponseMessage).type === "message")
    .flatMap((message) => message.content ?? [])
    .filter((content) => content.type === "output_text" && typeof content.text === "string")
    .map((content) => content.text?.trim())
    .filter((value): value is string => Boolean(value));

  return messageTexts.join("\n").trim();
}

function extractFunctionCalls(payload: ResponsesApiPayload) {
  return (payload.output ?? []).filter(
    (item): item is ResponseFunctionCall =>
      typeof item === "object" && item !== null && (item as ResponseFunctionCall).type === "function_call",
  );
}

function buildToolSchema(tool: ToolDefinition) {
  return {
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema,
  };
}

function maybeAutoLoginRequest(input: string) {
  const lower = input.toLowerCase();
  return /sign in|login|log in|remote|deploy|create.*dataset|make.*dataset|upload|run /.test(lower);
}

function maybeHandleUnauthenticatedLocalRequest(input: string) {
  const lower = input.toLowerCase();
  if (/list .*local|show .*local|local datasets|instances/.test(lower)) {
    return "list_local_datasets";
  }
  if (/show .*runs|list .*runs|tracked runs|active runs/.test(lower)) {
    return "list_tracked_runs";
  }
  return null;
}

function createToolRegistry(): ToolDefinition[] {
  return [
    {
      name: "login",
      description: "Sign in to alpharesearch.nyc and save a CLI session token locally.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
      async execute(context) {
        if (context.session) {
          return {
            summary: `Already signed in to ${context.session.origin}.`,
            data: { origin: context.session.origin, createdAt: context.session.createdAt },
          };
        }
        const session = await login({}, (message) => {
          context.emit({ role: "tool", content: message });
        });
        context.session = session;
        return {
          summary: `Signed in to ${session.origin}.`,
          data: { origin: session.origin, createdAt: session.createdAt },
        };
      },
    },
    {
      name: "resolve_local_dataset",
      description: "Resolve a vague local dataset description to an absolute file path and inferred ingest defaults.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          hint: { type: "string" },
        },
        required: ["hint"],
      },
      async execute(_context, input) {
        const hint = typeof input.hint === "string" ? input.hint : "";
        const resolvedPath = await inferLocalDatasetPath(hint);
        if (!resolvedPath) {
          return {
            summary: "Could not resolve a local dataset file from that description.",
            data: { ok: false },
          };
        }
        const defaults = inferDatasetDefaults(resolvedPath);
        const ingestFlags = inferDatasetIngestFlags(resolvedPath);
        const metadata = await stat(resolvedPath);
        return {
          summary: `Resolved local dataset to ${resolvedPath}.`,
          data: {
            ok: true,
            inputPath: resolvedPath,
            mode: inferModeFromPath(resolvedPath),
            instanceId: defaults.id,
            datasetId: defaults.datasetId,
            name: defaults.name,
            sizeBytes: metadata.size,
            ingestConfig: ingestFlags ?? undefined,
          },
        };
      },
    },
    {
      name: "profile_local_dataset",
      description: "Inspect a local dataset file and return a schema summary plus sample rows for remote profiling and experiment planning.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          inputPath: { type: "string" },
        },
        required: ["inputPath"],
      },
      async execute(_context, input) {
        const inputPath = String(input.inputPath);
        const profile = await inspectLocalDatasetFile(inputPath);
        return {
          summary: `Inspected local dataset ${basename(inputPath)}.`,
          data: profile,
        };
      },
    },
    {
      name: "list_local_datasets",
      description: "List local dataset instances available in the CLI workspace.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
      async execute() {
        const instances = await listInstanceBundles(DEFAULT_INSTANCE_ROOT);
        return {
          summary: instances.length > 0
            ? `Found ${instances.length} local dataset${instances.length === 1 ? "" : "s"}.`
            : "No local datasets found.",
          data: { instances },
        };
      },
    },
    {
      name: "list_remote_datasets",
      description: "List datasets registered on the remote Alpha Research control plane.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
      async execute(context) {
        const client = createRemoteClient(context);
        const datasets = await client.listDatasets();
        return {
          summary: datasets.datasets.length > 0
            ? `Found ${datasets.datasets.length} remote dataset${datasets.datasets.length === 1 ? "" : "s"}.`
            : "No remote datasets found.",
          data: datasets,
        };
      },
    },
    {
      name: "inspect_remote_dataset",
      description: "Inspect a remote dataset including ingest config, deployment metadata, schema profile, and sample rows when available.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          datasetId: { type: "string" },
        },
        required: ["datasetId"],
      },
      async execute(context, input) {
        const client = createRemoteClient(context);
        const datasetId = String(input.datasetId);
        const payload = await client.getDataset(datasetId);
        return {
          summary: `Inspected remote dataset ${datasetId}.`,
          data: payload,
        };
      },
    },
    {
      name: "compare_remote_datasets",
      description: "Compare multiple remote datasets by schema, ingest config, deployment status, and profile metadata.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          datasetIds: {
            type: "array",
            items: { type: "string" },
            minItems: 2,
          },
        },
        required: ["datasetIds"],
      },
      async execute(context, input) {
        const client = createRemoteClient(context);
        const datasetIds = Array.isArray(input.datasetIds) ? input.datasetIds.map(String) : [];
        const datasets = await Promise.all(datasetIds.map(async (datasetId) => (await client.getDataset(datasetId)).dataset));
        return {
          summary: `Compared ${datasets.length} remote datasets.`,
          data: { datasets },
        };
      },
    },
    {
      name: "list_tracked_runs",
      description: "List RESEARCH runs tracked locally by the CLI, including in-progress deploy or query runs.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
      async execute() {
        const runs = await readTrackedRuns();
        const active = runs.filter((item) => !item.terminalAt && !isTerminalRunStatus(item.status));
        return {
          summary: active.length > 0
            ? `Loaded run history. ${active.length} active run${active.length === 1 ? "" : "s"} right now.`
            : runs.length > 0
              ? "Loaded run history."
              : "No tracked runs yet.",
          data: { runs },
        };
      },
    },
    {
      name: "list_research_specs",
      description: "List saved research specs or hypothesis plans for a dataset or account.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          datasetId: { type: "string" },
        },
      },
      async execute(context, input) {
        const client = createRemoteClient(context);
        const datasetId = typeof input.datasetId === "string" ? input.datasetId : undefined;
        const payload = await client.listResearchSpecs(datasetId);
        return {
          summary: payload.specs.length > 0
            ? `Found ${payload.specs.length} research spec${payload.specs.length === 1 ? "" : "s"}.`
            : "No research specs found.",
          data: payload,
        };
      },
    },
    {
      name: "create_research_spec",
      description: "Create a structured research or hypothesis plan for a dataset, including subset, shaping, labeling, and result artifact requirements.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          datasetId: { type: "string" },
          hypothesis: { type: "string" },
          spec: { type: "object" },
          status: { type: "string" },
        },
        required: ["datasetId", "hypothesis"],
      },
      async execute(context, input) {
        const client = createRemoteClient(context);
        const payload = await client.createResearchSpec({
          datasetId: String(input.datasetId),
          hypothesis: String(input.hypothesis),
          spec: input.spec && typeof input.spec === "object" ? input.spec as Record<string, unknown> : undefined,
          status: typeof input.status === "string" ? input.status : undefined,
        });
        return {
          summary: `Created research spec ${payload.spec.id}.`,
          data: payload,
        };
      },
    },
    {
      name: "register_remote_dataset",
      description: "Create or update a remote dataset record before source upload and deploy.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          datasetId: { type: "string" },
          name: { type: "string" },
          inputPath: { type: "string" },
          mode: { type: "string", enum: ["auto", "tabular", "unstructured"] },
          description: { type: "string" },
        },
        required: ["datasetId", "name"],
      },
      async execute(context, input) {
        const client = createRemoteClient(context);
        const datasetId = String(input.datasetId);
        const name = String(input.name);
        const inputPath = typeof input.inputPath === "string" ? input.inputPath : "";
        const isPublicPlaceholder = inputPath.startsWith("public://");
        const inferredFlags = inputPath ? inferDatasetIngestFlags(inputPath) : null;
        const result = await client.createDataset({
          datasetId,
          name,
          sourceType: isPublicPlaceholder ? "public_data" : "uploaded_source",
          sourceFilename: inputPath ? (isPublicPlaceholder ? "internet" : basename(inputPath)) : undefined,
          mode: (typeof input.mode === "string" ? input.mode : (inputPath ? inferModeFromPath(inputPath) : "auto")) as
            "auto" | "tabular" | "unstructured",
          description: typeof input.description === "string"
            ? input.description
            : inputPath
              ? `Uploaded from ${inputPath}`
              : undefined,
          ingestConfig: inferredFlags
            ? {
                entityType: inferredFlags.entityType,
                titleField: inferredFlags.titleField,
                summaryField: inferredFlags.summaryField,
                textFields: inferredFlags.textFields,
                dateField: inferredFlags.dateField,
              }
            : undefined,
        });
        return {
          summary: `Registered remote dataset ${datasetId}.`,
          data: result,
        };
      },
    },
    {
      name: "update_remote_dataset_profile",
      description: "Attach schema, sample rows, and notes to a remote dataset so future hypothesis planning can inspect the dataset content.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          datasetId: { type: "string" },
          schema: {},
          sampleRows: {},
          notes: { type: "string" },
        },
        required: ["datasetId"],
      },
      async execute(context, input) {
        const client = createRemoteClient(context);
        const payload = await client.updateDatasetProfile(String(input.datasetId), {
          schema: input.schema,
          sampleRows: input.sampleRows,
          notes: typeof input.notes === "string" ? input.notes : undefined,
        });
        return {
          summary: `Updated profile for remote dataset ${String(input.datasetId)}.`,
          data: payload,
        };
      },
    },
    {
      name: "create_research_environment",
      description: "Create a remote research environment from public sources, private/local uploaded files, or a mix. This provisions a dataset volume, uploads local private sources when provided, and prompts a remote agent to fetch, stage, normalize, validate, and document all data.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          datasetId: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          sourceDescription: { type: "string" },
          publicSources: {
            type: "array",
            items: { type: "object" },
          },
          localPaths: {
            type: "array",
            items: { type: "string" },
          },
          prompt: { type: "string" },
          artifacts: {
            type: "array",
            items: { type: "object" },
          },
        },
        required: ["datasetId", "name", "prompt"],
      },
      async execute(context, input) {
        const client = createRemoteClient(context);
        const datasetId = String(input.datasetId);
        const name = String(input.name);
        const prompt = String(input.prompt);
        const publicSources = Array.isArray(input.publicSources)
          ? input.publicSources as Array<Record<string, unknown>>
          : [];
        const localPaths = Array.isArray(input.localPaths)
          ? input.localPaths.map((value) => String(value)).filter(Boolean)
          : [];
        await client.createDataset({
          datasetId,
          name,
          sourceType: localPaths.length > 0 && (publicSources.length > 0 || input.sourceDescription) ? "mixed_data" : localPaths.length > 0 ? "private_data" : "public_data",
          sourceFilename: localPaths.length > 0 && (publicSources.length > 0 || input.sourceDescription) ? "mixed" : localPaths.length > 0 ? "private-uploads" : "internet",
          mode: "tabular",
          description: typeof input.description === "string" ? input.description : undefined,
        });
        const privateSources: Array<{ key: string; filename: string; sizeBytes?: number; description?: string }> = [];
        for (const inputPath of localPaths) {
          const filename = basename(inputPath);
          const upload = await client.requestDatasetSourceUpload(datasetId, {
            filename,
            sizeBytes: (await stat(inputPath)).size,
          });
          context.emit({ role: "tool", content: `Uploading ${inputPath}` });
          const sizeBytes = await uploadFileToPresignedUrl(inputPath, upload.upload.url, (message) => {
            context.emit({ role: "tool", content: message });
          });
          privateSources.push({
            key: upload.upload.key,
            filename,
            sizeBytes,
            description: `Uploaded from ${inputPath}`,
          });
        }
        const result = await client.createResearchEnvironment(datasetId, {
          name,
          description: typeof input.description === "string" ? input.description : undefined,
          sourceDescription: typeof input.sourceDescription === "string" ? input.sourceDescription : undefined,
          publicSources,
          privateSources,
          prompt,
          artifacts: Array.isArray(input.artifacts) ? input.artifacts as Array<Record<string, unknown>> : undefined,
        });
        if (context.session) {
          await trackRemoteRun({
            id: result.run.id,
            datasetId: result.run.datasetId,
            origin: context.session.origin,
            status: result.run.status,
            prompt: result.run.prompt ?? prompt,
            createdAt: result.run.createdAt,
            updatedAt: result.run.updatedAt,
          });
          spawnRunWatcher(result.run.id);
        }
        return {
          summary: `Started research environment build ${result.run.id} for ${datasetId}. Dashboard: ${dashboardRunUrl(requireSession(context).origin, result.run.id)}`,
          data: result,
        };
      },
    },
    {
      name: "create_public_data_environment",
      description: "Create a new remote research environment from public internet/API data by provisioning an empty dataset volume and prompting a remote agent to fetch, normalize, validate, and document the data.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          datasetId: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          sourceDescription: { type: "string" },
          prompt: { type: "string" },
          artifacts: {
            type: "array",
            items: { type: "object" },
          },
        },
        required: ["datasetId", "name", "sourceDescription", "prompt"],
      },
      async execute(context, input) {
        const client = createRemoteClient(context);
        const datasetId = String(input.datasetId);
        const prompt = String(input.prompt);
        const result = await client.createPublicDataEnvironment(datasetId, {
          name: String(input.name),
          description: typeof input.description === "string" ? input.description : undefined,
          sourceDescription: String(input.sourceDescription),
          prompt,
          artifacts: Array.isArray(input.artifacts) ? input.artifacts as Array<Record<string, unknown>> : undefined,
        });
        if (context.session) {
          await trackRemoteRun({
            id: result.run.id,
            datasetId: result.run.datasetId,
            origin: context.session.origin,
            status: result.run.status,
            prompt: result.run.prompt ?? prompt,
            createdAt: result.run.createdAt,
            updatedAt: result.run.updatedAt,
          });
          spawnRunWatcher(result.run.id);
        }
        return {
          summary: `Started public-data environment build ${result.run.id} for ${datasetId}. Dashboard: ${dashboardRunUrl(requireSession(context).origin, result.run.id)}`,
          data: result,
        };
      },
    },
    {
      name: "request_dataset_source_upload",
      description: "Request a presigned upload target for a local dataset file.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          datasetId: { type: "string" },
          inputPath: { type: "string" },
          filename: { type: "string" },
        },
        required: ["datasetId"],
      },
      async execute(context, input) {
        const client = createRemoteClient(context);
        const datasetId = String(input.datasetId);
        const inputPath = typeof input.inputPath === "string" ? input.inputPath : "";
        const filename = typeof input.filename === "string" && input.filename.trim()
          ? input.filename.trim()
          : inputPath
            ? basename(inputPath)
            : "";
        if (!filename) {
          throw new Error("request_dataset_source_upload requires inputPath or filename.");
        }
        const sizeBytes = inputPath ? (await stat(inputPath)).size : undefined;
        const upload = await client.requestDatasetSourceUpload(datasetId, { filename, sizeBytes });
        return {
          summary: `Requested upload target for ${filename}.`,
          data: upload,
        };
      },
    },
    {
      name: "upload_local_file",
      description: "Upload a local file to a presigned object-store URL.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          inputPath: { type: "string" },
          uploadUrl: { type: "string" },
        },
        required: ["inputPath", "uploadUrl"],
      },
      async execute(context, input) {
        const inputPath = String(input.inputPath);
        const uploadUrl = String(input.uploadUrl);
        const sizeBytes = await uploadFileToPresignedUrl(inputPath, uploadUrl, (message) => {
          context.emit({ role: "tool", content: message });
        });
        return {
          summary: `Uploaded ${basename(inputPath)}.`,
          data: { inputPath, sizeBytes },
        };
      },
    },
    {
      name: "complete_dataset_source_upload",
      description: "Mark the uploaded dataset source as complete on the remote control plane.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          datasetId: { type: "string" },
          sizeBytes: { type: "number" },
        },
        required: ["datasetId"],
      },
      async execute(context, input) {
        const client = createRemoteClient(context);
        const datasetId = String(input.datasetId);
        const sizeBytes = typeof input.sizeBytes === "number" ? input.sizeBytes : undefined;
        await client.completeDatasetSourceUpload(datasetId, { sizeBytes });
        return {
          summary: `Marked source upload complete for ${datasetId}.`,
          data: { datasetId, sizeBytes },
        };
      },
    },
    {
      name: "deploy_remote_dataset",
      description: "Provision remote infrastructure and start normalization for a registered dataset.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          datasetId: { type: "string" },
        },
        required: ["datasetId"],
      },
      async execute(context, input) {
        const client = createRemoteClient(context);
        const datasetId = String(input.datasetId);
        const deployment = await client.deployDataset(datasetId);
        if (deployment.run && context.session) {
          await trackRemoteRun({
            id: deployment.run.id,
            datasetId: deployment.run.datasetId,
            origin: context.session.origin,
            status: deployment.run.status,
            prompt: deployment.run.prompt,
            createdAt: deployment.run.createdAt,
            updatedAt: deployment.run.updatedAt,
          });
        }
        return {
          summary: `Started deployment for ${datasetId}.`,
          data: deployment,
        };
      },
    },
    {
      name: "deploy_local_instance",
      description: "Register and deploy an existing local normalized instance bundle.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          instanceId: { type: "string" },
          datasetId: { type: "string" },
        },
        required: ["instanceId"],
      },
      async execute(context, input) {
        const client = createRemoteClient(context);
        const instanceId = String(input.instanceId);
        const bootstrap = await getInstanceBootstrap(DEFAULT_INSTANCE_ROOT, instanceId);
        const datasetId = typeof input.datasetId === "string" && input.datasetId.trim()
          ? input.datasetId.trim()
          : bootstrap.descriptor.id;
        await client.createDataset({
          name: bootstrap.implementation.productName,
          datasetId,
          sourceType: "local_instance",
          instanceId,
          manifestPath: `${DEFAULT_INSTANCE_ROOT}/${instanceId}/manifest.json`,
          description: bootstrap.descriptor.description,
        });
        const deployment = await client.deployDataset(datasetId);
        if (deployment.run && context.session) {
          await trackRemoteRun({
            id: deployment.run.id,
            datasetId: deployment.run.datasetId,
            origin: context.session.origin,
            status: deployment.run.status,
            prompt: deployment.run.prompt,
            createdAt: deployment.run.createdAt,
            updatedAt: deployment.run.updatedAt,
          });
        }
        return {
          summary: `Started deployment for local instance ${instanceId}.`,
          data: deployment,
        };
      },
    },
    {
      name: "start_remote_run",
      description: "Start a structured remote agent run against a dataset, including hypothesis tests, public-data fetches, transformations, labeling jobs, and artifact requests.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          datasetId: { type: "string" },
          prompt: { type: "string" },
          type: {
            type: "string",
            enum: ["analysis", "fetch", "transform", "label", "hypothesis", "agent"],
          },
          config: { type: "object" },
          artifacts: {
            type: "array",
            items: { type: "object" },
          },
        },
        required: ["datasetId", "prompt"],
      },
      async execute(context, input) {
        const client = createRemoteClient(context);
        const datasetId = String(input.datasetId);
        const prompt = String(input.prompt);
        let result;
        try {
          result = await client.startRun(datasetId, prompt, {
            type: typeof input.type === "string" ? input.type : undefined,
            config: input.config && typeof input.config === "object" ? input.config as Record<string, unknown> : undefined,
            artifacts: Array.isArray(input.artifacts) ? input.artifacts as Array<Record<string, unknown>> : undefined,
          });
        } catch (error) {
          if (error instanceof RemoteRequestError) {
            const summary = summarizeBusyDatasetConflict(error);
            if (summary) {
              return { summary, data: { ok: false, reason: "dataset_busy" } };
            }
          }
          throw error;
        }
        if (context.session) {
          await trackRemoteRun({
            id: result.run.id,
            datasetId: result.run.datasetId,
            origin: context.session.origin,
            status: result.run.status,
            prompt: result.run.prompt ?? prompt,
            createdAt: result.run.createdAt,
            updatedAt: result.run.updatedAt,
          });
          spawnRunWatcher(result.run.id);
        }
        return {
          summary: `Started run ${result.run.id} on ${datasetId}. Dashboard: ${dashboardRunUrl(requireSession(context).origin, result.run.id)}`,
          data: result,
        };
      },
    },
    {
      name: "query_remote_dataset",
      description: "Start a lightweight remote query against a deployed dataset and return immediately with a run id and dashboard link.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          datasetId: { type: "string" },
          prompt: { type: "string" },
        },
        required: ["datasetId", "prompt"],
      },
      async execute(context, input) {
        const client = createRemoteClient(context);
        const datasetId = String(input.datasetId);
        const prompt = String(input.prompt);
        let started;
        try {
          started = await withAuthRetry(context, () => client.startRun(datasetId, prompt, {
            type: "query",
            artifacts: [{ type: "query_result", title: "Query Result" }],
          }));
        } catch (error) {
          if (error instanceof RemoteRequestError) {
            const summary = summarizeBusyDatasetConflict(error);
            if (summary) {
              return { summary, data: { ok: false, reason: "dataset_busy" } };
            }
          }
          throw error;
        }
        if (context.session) {
          await trackRemoteRun({
            id: started.run.id,
            datasetId: started.run.datasetId,
            origin: context.session.origin,
            status: started.run.status,
            prompt: started.run.prompt ?? prompt,
            createdAt: started.run.createdAt,
            updatedAt: started.run.updatedAt,
          });
          spawnRunWatcher(started.run.id);
        }
        return {
          summary: `Started query run ${started.run.id}. Dashboard: ${dashboardRunUrl(requireSession(context).origin, started.run.id)}`,
          data: { run: started.run, pending: true },
        };
      },
    },
    {
      name: "aggregate_remote_dataset",
      description: "Start a lightweight remote aggregation against a deployed dataset and return immediately with a run id and dashboard link.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          datasetId: { type: "string" },
          prompt: { type: "string" },
        },
        required: ["datasetId", "prompt"],
      },
      async execute(context, input) {
        const client = createRemoteClient(context);
        const datasetId = String(input.datasetId);
        const prompt = String(input.prompt);
        let started;
        try {
          started = await withAuthRetry(context, () => client.startRun(datasetId, prompt, {
            type: "query",
            artifacts: [{ type: "aggregate_result", title: "Aggregate Result" }],
          }));
        } catch (error) {
          if (error instanceof RemoteRequestError) {
            const summary = summarizeBusyDatasetConflict(error);
            if (summary) {
              return { summary, data: { ok: false, reason: "dataset_busy" } };
            }
          }
          throw error;
        }
        if (context.session) {
          await trackRemoteRun({
            id: started.run.id,
            datasetId: started.run.datasetId,
            origin: context.session.origin,
            status: started.run.status,
            prompt: started.run.prompt ?? prompt,
            createdAt: started.run.createdAt,
            updatedAt: started.run.updatedAt,
          });
          spawnRunWatcher(started.run.id);
        }
        return {
          summary: `Started aggregate run ${started.run.id}. Dashboard: ${dashboardRunUrl(requireSession(context).origin, started.run.id)}`,
          data: { run: started.run, pending: true },
        };
      },
    },
    {
      name: "fetch_public_data",
      description: "Queue a remote public-data acquisition run that fetches internet data into a research environment.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          datasetId: { type: "string" },
          sourceDescription: { type: "string" },
          prompt: { type: "string" },
        },
        required: ["datasetId", "sourceDescription"],
      },
      async execute(context, input) {
        const datasetId = String(input.datasetId);
        const sourceDescription = String(input.sourceDescription);
        const client = createRemoteClient(context);
        let result;
        try {
          result = await client.startRun(datasetId, typeof input.prompt === "string" ? input.prompt : `Fetch public data: ${sourceDescription}`, {
            type: "fetch",
            config: { sourceDescription },
          });
        } catch (error) {
          if (error instanceof RemoteRequestError) {
            const summary = summarizeBusyDatasetConflict(error);
            if (summary) {
              return { summary, data: { ok: false, reason: "dataset_busy" } };
            }
          }
          throw error;
        }
        if (context.session) {
          await trackRemoteRun({
            id: result.run.id,
            datasetId: result.run.datasetId,
            origin: context.session.origin,
            status: result.run.status,
            prompt: result.run.prompt,
            createdAt: result.run.createdAt,
            updatedAt: result.run.updatedAt,
          });
          spawnRunWatcher(result.run.id);
        }
        return {
          summary: `Queued public-data fetch run ${result.run.id}. Dashboard: ${dashboardRunUrl(requireSession(context).origin, result.run.id)}`,
          data: result,
        };
      },
    },
    {
      name: "wait_for_run_completion",
      description: "Wait for a run to finish with backoff, stream new run events, and then fetch its final results once.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          runId: { type: "string" },
          timeoutSeconds: { type: "integer" },
        },
        required: ["runId"],
      },
      async execute(context, input) {
        const client = createRemoteClient(context);
        const timeoutSeconds = typeof input.timeoutSeconds === "number" ? input.timeoutSeconds : 180;
        const waited = await withAuthRetry(context, () => waitForRunCompletion(
          client,
          String(input.runId),
          context.emit,
          timeoutSeconds * 1000,
        ));
        return {
          summary: waited.complete
            ? `Run ${String(input.runId)} finished with status ${waited.run?.status ?? "unknown"}.`
            : `Run ${String(input.runId)} is still ${waited.run?.status ?? "running"}.`,
          data: waited,
        };
      },
    },
    {
      name: "start_remote_agent_run",
      description: "Start a remote agent run on a dataset-attached cloud environment and track its results.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          datasetId: { type: "string" },
          prompt: { type: "string" },
          artifacts: {
            type: "array",
            items: { type: "object" },
          },
        },
        required: ["datasetId", "prompt"],
      },
      async execute(context, input) {
        const client = createRemoteClient(context);
        let result;
        try {
          result = await client.startRun(String(input.datasetId), String(input.prompt), {
            type: "agent",
            artifacts: Array.isArray(input.artifacts) ? input.artifacts as Array<Record<string, unknown>> : undefined,
          });
        } catch (error) {
          if (error instanceof RemoteRequestError) {
            const summary = summarizeBusyDatasetConflict(error);
            if (summary) {
              return { summary, data: { ok: false, reason: "dataset_busy" } };
            }
          }
          throw error;
        }
        if (context.session) {
          await trackRemoteRun({
            id: result.run.id,
            datasetId: result.run.datasetId,
            origin: context.session.origin,
            status: result.run.status,
            prompt: result.run.prompt ?? String(input.prompt),
            createdAt: result.run.createdAt,
            updatedAt: result.run.updatedAt,
          });
          spawnRunWatcher(result.run.id);
        }
        return {
          summary: `Queued remote agent run ${result.run.id}. Dashboard: ${dashboardRunUrl(requireSession(context).origin, result.run.id)}`,
          data: result,
        };
      },
    },
    {
      name: "continue_remote_agent_run",
      description: "Continue a previous remote agent run by resuming its remote agent session with a follow-up prompt.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          runId: { type: "string" },
          prompt: { type: "string" },
          artifacts: {
            type: "array",
            items: { type: "object" },
          },
        },
        required: ["runId", "prompt"],
      },
      async execute(context, input) {
        const client = createRemoteClient(context);
        const previous = await client.getRunResults(String(input.runId));
        const sessionArtifact = previous.artifacts.find((artifact) => artifact.type === "remote_agent_session");
        const sessionId = sessionArtifact && typeof sessionArtifact.content === "object" && sessionArtifact.content
          ? String((sessionArtifact.content as Record<string, unknown>).sessionId ?? "")
          : "";
        if (!sessionId) {
          throw new Error(`Run ${String(input.runId)} does not have a resumable remote agent session.`);
        }
        let result;
        try {
          result = await client.startRun(previous.run.datasetId, String(input.prompt), {
            type: "agent",
            config: { remoteAgentSessionId: sessionId, parentRunId: String(input.runId) },
            artifacts: Array.isArray(input.artifacts) ? input.artifacts as Array<Record<string, unknown>> : undefined,
          });
        } catch (error) {
          if (error instanceof RemoteRequestError) {
            const summary = summarizeBusyDatasetConflict(error);
            if (summary) {
              return { summary, data: { ok: false, reason: "dataset_busy" } };
            }
          }
          throw error;
        }
        if (context.session) {
          await trackRemoteRun({
            id: result.run.id,
            datasetId: result.run.datasetId,
            origin: context.session.origin,
            status: result.run.status,
            prompt: result.run.prompt ?? String(input.prompt),
            createdAt: result.run.createdAt,
            updatedAt: result.run.updatedAt,
          });
          spawnRunWatcher(result.run.id);
        }
        return {
          summary: `Queued continuation of remote agent session ${sessionId} as run ${result.run.id}. Dashboard: ${dashboardRunUrl(requireSession(context).origin, result.run.id)}`,
          data: result,
        };
      },
    },
    {
      name: "run_remote_transformation",
      description: "Queue a remote transformation run that reshapes or filters data inside an existing research environment.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          datasetId: { type: "string" },
          prompt: { type: "string" },
          scriptOutline: { type: "string" },
        },
        required: ["datasetId", "prompt"],
      },
      async execute(context, input) {
        const client = createRemoteClient(context);
        let result;
        try {
          result = await client.startRun(String(input.datasetId), String(input.prompt), {
            type: "transform",
            config: {
              scriptOutline: typeof input.scriptOutline === "string" ? input.scriptOutline : undefined,
            },
          });
        } catch (error) {
          if (error instanceof RemoteRequestError) {
            const summary = summarizeBusyDatasetConflict(error);
            if (summary) {
              return { summary, data: { ok: false, reason: "dataset_busy" } };
            }
          }
          throw error;
        }
        if (context.session) {
          await trackRemoteRun({
            id: result.run.id,
            datasetId: result.run.datasetId,
            origin: context.session.origin,
            status: result.run.status,
            prompt: result.run.prompt,
            createdAt: result.run.createdAt,
            updatedAt: result.run.updatedAt,
          });
          spawnRunWatcher(result.run.id);
        }
        return {
          summary: `Queued transformation run ${result.run.id}. Dashboard: ${dashboardRunUrl(requireSession(context).origin, result.run.id)}`,
          data: result,
        };
      },
    },
    {
      name: "run_remote_labeling",
      description: "Queue a remote labeling or enrichment run, including the explicit LLM prompt to use for labeling data points.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          datasetId: { type: "string" },
          prompt: { type: "string" },
          labelingPrompt: { type: "string" },
        },
        required: ["datasetId", "labelingPrompt"],
      },
      async execute(context, input) {
        const client = createRemoteClient(context);
        const labelingPrompt = String(input.labelingPrompt);
        let result;
        try {
          result = await client.startRun(
            String(input.datasetId),
            typeof input.prompt === "string" ? input.prompt : `Run labeling job: ${labelingPrompt}`,
            {
              type: "label",
              config: { labelingPrompt },
            },
          );
        } catch (error) {
          if (error instanceof RemoteRequestError) {
            const summary = summarizeBusyDatasetConflict(error);
            if (summary) {
              return { summary, data: { ok: false, reason: "dataset_busy" } };
            }
          }
          throw error;
        }
        if (context.session) {
          await trackRemoteRun({
            id: result.run.id,
            datasetId: result.run.datasetId,
            origin: context.session.origin,
            status: result.run.status,
            prompt: result.run.prompt,
            createdAt: result.run.createdAt,
            updatedAt: result.run.updatedAt,
          });
          spawnRunWatcher(result.run.id);
        }
        return {
          summary: `Queued labeling run ${result.run.id}. Dashboard: ${dashboardRunUrl(requireSession(context).origin, result.run.id)}`,
          data: result,
        };
      },
    },
    {
      name: "get_run_results",
      description: "Retrieve a run together with current status, structured metadata, requested artifacts, produced artifacts, and recent events.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          runId: { type: "string" },
        },
        required: ["runId"],
      },
      async execute(context, input) {
        const client = createRemoteClient(context);
        const payload = await client.getRunResults(String(input.runId));
        const requestedArtifacts = Array.isArray(payload.metadata?.artifactSpec) ? payload.metadata?.artifactSpec : [];
        const producedArtifacts = payload.artifacts.filter(isProducedArtifact);
        const humanSummary = summarizeRunResultsForHumans(
          {
            run: {
              id: payload.run.id,
              datasetId: payload.run.datasetId,
              status: payload.run.status,
              prompt: payload.run.prompt,
            },
            artifacts: producedArtifacts,
          },
          requireSession(context).origin,
        );
        return {
          summary: `${humanSummary}${requestedArtifacts.length > 0 ? `\n\nRequested artifacts: ${requestedArtifacts.length}` : ""}`,
          data: payload,
        };
      },
    },
    {
      name: "list_run_artifacts",
      description: "List requested or completed artifacts for a run, such as charts, tables, or result bundles.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          runId: { type: "string" },
        },
        required: ["runId"],
      },
      async execute(context, input) {
        const client = createRemoteClient(context);
        const payload = await client.getRunArtifacts(String(input.runId));
        const producedArtifacts = payload.artifacts.filter(isProducedArtifact);
        return {
          summary: producedArtifacts.length > 0
            ? [
              `Found ${producedArtifacts.length} artifact${producedArtifacts.length === 1 ? "" : "s"} for run ${String(input.runId)}.`,
              "Artifacts are the saved outputs from the run. Open them on the run page:",
              ...producedArtifacts.map((artifact) => `- ${artifactBullet(artifact)}`),
            ].join("\n")
            : `No produced artifacts found for run ${String(input.runId)} yet.`,
          data: payload,
        };
      },
    },
    {
      name: "cancel_remote_run",
      description: "Cancel an in-progress remote run and terminate its cloud droplet when possible.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          runId: { type: "string" },
        },
        required: ["runId"],
      },
      async execute(context, input) {
        const client = createRemoteClient(context);
        const runId = String(input.runId);
        const payload = await client.cancelRun(runId);
        if (context.session) {
          await trackRemoteRun({
            id: payload.run.id,
            datasetId: payload.run.datasetId,
            origin: context.session.origin,
            status: payload.run.status,
            prompt: payload.run.prompt,
            createdAt: payload.run.createdAt,
            updatedAt: payload.run.updatedAt,
          });
        }
        return {
          summary: `Cancelled remote run ${runId}.`,
          data: payload,
        };
      },
    },
  ];
}

export async function runAgentTurn(
  input: string,
  initialSession: SessionRecord | null,
  emit: (message: AgentMessage) => void,
  conversationState?: AgentConversationState,
): Promise<AgentConversationState> {
  if (looksLikeIncompleteTask(input)) {
    emit({
      role: "assistant",
      content: "Your request ends mid-instruction after `Then ...`. Send the rest of the task and I’ll start it.",
    });
    return {
      sessionId: conversationState?.sessionId ?? null,
      previousResponseId: conversationState?.previousResponseId ?? null,
    };
  }

  const localIntent = !initialSession ? maybeHandleUnauthenticatedLocalRequest(input) : null;
  const exposeWaitTool = shouldExposeWaitTool(input);
  const exposeRunInspectionTools = shouldExposeRunInspectionTools(input);
  const toolRegistry = createToolRegistry().filter((tool) => {
    if (!exposeWaitTool && tool.name === "wait_for_run_completion") {
      return false;
    }
    if (!exposeRunInspectionTools && (tool.name === "get_run_results" || tool.name === "list_run_artifacts")) {
      return false;
    }
    return true;
  });
  const toolsByName = new Map(toolRegistry.map((tool) => [tool.name, tool]));
  const context: ToolExecutionContext = {
    session: initialSession,
    sessionId: conversationState?.sessionId ?? null,
    emit,
  };

  if (!context.session && localIntent) {
    const tool = toolsByName.get(localIntent);
    if (!tool) {
      throw new Error(`Missing local tool: ${localIntent}`);
    }
    emit({ role: "tool", content: `Running ${tool.name}` });
    const result = await tool.execute(context, {});
    emit({ role: "assistant", content: typeof result.data === "object" ? JSON.stringify(result.data, null, 2) : result.summary });
    return {
      sessionId: context.sessionId,
      previousResponseId: conversationState?.previousResponseId ?? null,
    };
  }

  if (!context.session && maybeAutoLoginRequest(input)) {
    const loginTool = toolsByName.get("login");
    if (!loginTool) {
      throw new Error("Missing login tool.");
    }
    emit({ role: "tool", content: "Signing in before continuing." });
    const result = await loginTool.execute(context, {});
    emit({ role: "assistant", content: result.summary });
  }

  if (!context.session) {
    emit({
      role: "assistant",
      content: "Sign in first with `/login`, then ask me to create datasets, deploy them, or manage runs.",
    });
    return {
      sessionId: context.sessionId,
      previousResponseId: conversationState?.previousResponseId ?? null,
    };
  }

  const toolSchemas = toolRegistry.map(buildToolSchema);
  const previousResponseId = shouldStartFreshConversation(input)
    ? undefined
    : conversationState?.previousResponseId ?? undefined;
  let response = await withAuthRetry(context, async () => {
    const activeClient = new RemoteApiClient(requireSession(context));
    const replied = await activeClient.respond({
      instructions: AGENT_INSTRUCTIONS,
      input,
      previous_response_id: previousResponseId,
      tools: toolSchemas,
      parallel_tool_calls: false,
    });
    context.sessionId = replied.sessionId ?? context.sessionId;
    conversationState = {
      sessionId: context.sessionId,
      previousResponseId:
        typeof (replied.payload as { id?: unknown }).id === "string"
          ? String((replied.payload as { id?: unknown }).id)
          : conversationState?.previousResponseId ?? null,
    };
    return replied.payload as ResponsesApiPayload;
  });

  await persistSessionEntry(context, {
    role: "user",
    kind: "local_user",
    title: "CLI input",
    content: input,
    metadata: {
      previousResponseId: conversationState?.previousResponseId ?? null,
    },
  });

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const functionCalls = extractFunctionCalls(response);
    if (functionCalls.length === 0) {
      const text = extractOutputText(response);
      emit({
        role: "assistant",
        content: text || "Done.",
      });
      await persistSessionEntry(context, {
        role: "assistant",
        kind: "local_assistant",
        title: "CLI response",
        content: text || "Done.",
      });
      return {
        sessionId: context.sessionId,
        previousResponseId: conversationState?.previousResponseId ?? null,
      };
    }

    const toolOutputs: Array<{ type: "function_call_output"; call_id: string; output: string }> = [];

    for (const call of functionCalls) {
      const toolName = call.name ?? "";
      const tool = toolsByName.get(toolName);
      if (!tool) {
        throw new Error(`Model requested unknown tool: ${toolName}`);
      }
      emit({ role: "tool", content: `Calling ${tool.name}` });
      const parsedArguments = parseJsonArguments(call.arguments);
      await persistSessionEntry(context, {
        role: "tool",
        kind: "tool_call",
        title: tool.name,
        content: `Calling ${tool.name}`,
        metadata: { name: tool.name, arguments: parsedArguments },
      });
      const result = await withAuthRetry(context, () => tool.execute(context, parsedArguments));
      emit({ role: "tool", content: result.summary });
      await persistSessionEntry(context, {
        role: "tool",
        kind: "tool_result",
        title: tool.name,
        content: result.summary,
        metadata: { name: tool.name, data: result.data },
      });
      if (ASYNC_RUN_START_TOOLS.has(tool.name) && !exposeWaitTool) {
        const finalSummary =
          context.session && context.sessionId
            ? `${result.summary}\nTerminal session: ${dashboardTerminalSessionUrl(context.session.origin, context.sessionId, (result.data as { run?: { id?: string } } | undefined)?.run?.id ? String((result.data as { run?: { id?: string } }).run?.id) : null)}`
            : result.summary;
        emit({ role: "assistant", content: finalSummary });
        await persistSessionEntry(context, {
          role: "assistant",
          kind: "local_summary",
          title: "CLI summary",
          content: finalSummary,
        });
        return {
          sessionId: context.sessionId,
          previousResponseId: conversationState?.previousResponseId ?? null,
        };
      }
      if (ASYNC_RUN_START_TOOLS.has(tool.name) && exposeWaitTool) {
        // Stop after the first async launch even in explicit wait mode; subsequent waiting happens via the dedicated wait tool.
        toolOutputs.push({
          type: "function_call_output",
          call_id: call.call_id ?? tool.name,
          output: JSON.stringify({
            ok: true,
            summary: result.summary,
            data: result.data,
          }),
        });
        break;
      }
      toolOutputs.push({
        type: "function_call_output",
        call_id: call.call_id ?? tool.name,
        output: JSON.stringify({
          ok: true,
          summary: result.summary,
          data: result.data,
        }),
      });
    }

    const refreshedSession = await readSession();
    if (refreshedSession?.accessToken !== context.session.accessToken || refreshedSession?.origin !== context.session.origin) {
      context.session = refreshedSession;
    }
    if (!context.session) {
      emit({
        role: "assistant",
        content: "Your RESEARCH session was cleared while tools were running. Sign in again with `/login`.",
      });
      return {
        sessionId: context.sessionId,
        previousResponseId: conversationState?.previousResponseId ?? null,
      };
    }

    response = await withAuthRetry(context, async () => {
      const activeClient = new RemoteApiClient(requireSession(context));
      const replied = await activeClient.respond({
        previous_response_id: response.id,
        input: toolOutputs,
        tools: toolSchemas,
        parallel_tool_calls: false,
      });
      context.sessionId = replied.sessionId ?? context.sessionId;
      conversationState = {
        sessionId: context.sessionId,
        previousResponseId:
          typeof (replied.payload as { id?: unknown }).id === "string"
            ? String((replied.payload as { id?: unknown }).id)
            : conversationState?.previousResponseId ?? null,
      };
      return replied.payload as ResponsesApiPayload;
    });
  }

  emit({
    role: "assistant",
    content: "I hit the tool-call limit before finishing. Try again or narrow the request.",
  });
  return {
    sessionId: context.sessionId,
    previousResponseId: conversationState?.previousResponseId ?? null,
  };
}

export function currentOrigin(session: SessionRecord | null) {
  return session?.origin ?? DEFAULT_WEB_ORIGIN;
}
