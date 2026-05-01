import { access, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";

import { getInstanceBootstrap, listInstanceBundles } from "@rprend/alpha-storage";

import { DEFAULT_INSTANCE_ROOT, DEFAULT_WEB_ORIGIN, dashboardRunUrl, dashboardTerminalSessionUrl, type SessionRecord } from "./config.js";
import { inferDatasetDefaults, inferDatasetIngestFlags, inspectLocalDatasetFile, uploadFileToPresignedUrl } from "./local-tools.js";
import { RemoteApiClient, RemoteRequestError, type RemoteApiClient as RemoteApiClientType, type RemoteDatasetSummary } from "./remote.js";
import { readSession, login } from "./session.js";
import { isTerminalRunStatus, isUncertainRunStatus, readTrackedRuns, spawnRunWatcher, trackRemoteRun } from "./runs.js";

export type AgentMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

export type AgentToolResult = {
  summary: string;
  data?: unknown;
};

type JsonSchema = Record<string, unknown>;

export type ToolExecutionContext = {
  session: SessionRecord | null;
  sessionId: string | null;
  emit: (message: AgentMessage) => void;
  deps: AgentRuntimeDeps;
};

export type AgentConversationState = {
  sessionId: string | null;
  previousResponseId: string | null;
};

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  execute: (context: ToolExecutionContext, input: Record<string, unknown>) => Promise<AgentToolResult>;
};

export type ToolRegistryMetadata = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  asyncRunStart: boolean;
};

export type AgentRuntimeDeps = {
  createRemoteClient: (session: SessionRecord) => RemoteApiClientType;
  readSession: typeof readSession;
  login: typeof login;
  createToolRegistry: () => ToolDefinition[];
};

const STANDARD_ANALYSIS_RESOURCES = {
  profile: "standard-analysis",
  runnerSize: "s-8vcpu-16gb",
  workspaceDiskGb: 500,
};

const DATASET_BRIEFING_ARTIFACTS = [
  { type: "markdown", title: "Dataset Briefing" },
  { type: "json", title: "Dataset Profile" },
] as const;

function mountedDatasetGrounding(datasetId: string) {
  return {
    required: true,
    datasetId,
    mountPaths: [
      `/mnt/alpha-research/data/instances/${datasetId}`,
      `/mnt/alpha-research/datasets/${datasetId}`,
      "dataset",
    ],
    failOnUnreadable: true,
    disallowExternalFallback: true,
  };
}

function withStandardAnalysisResources(config?: Record<string, unknown>, datasetId?: string) {
  return {
    ...(config ?? {}),
    resources: {
      ...STANDARD_ANALYSIS_RESOURCES,
      ...(config?.resources && typeof config.resources === "object"
        ? config.resources as Record<string, unknown>
        : {}),
    },
    ...(datasetId ? { mountedDatasetGrounding: mountedDatasetGrounding(datasetId) } : {}),
  };
}

function withMountedDatasetGroundingPrompt(datasetId: string, prompt: string) {
  return [
    `Mounted dataset grounding is mandatory for dataset \`${datasetId}\`.`,
    "Before doing analysis, read and validate the mounted dataset from the attached dataset volume, preferring these paths in order:",
    `1. /mnt/alpha-research/data/instances/${datasetId}`,
    `2. /mnt/alpha-research/datasets/${datasetId}`,
    "3. ./dataset only if it is a mount/symlink/copy of the attached dataset volume.",
    "If the mounted dataset cannot be found, opened, or parsed, fail the run loudly with the exact paths checked and the read error.",
    "Do not download public sample data, GitHub CSVs, web search results, synthetic replacements, or any other external fallback to complete this dataset-grounded task.",
    "",
    prompt,
  ].join("\n");
}

function datasetBriefingPrompt(datasetId: string) {
  return [
    `Describe dataset ${datasetId}.`,
    "",
    "Produce a durable documentation briefing for humans. Do not include query instructions, starter analyses, or suggestions for how to use agents; this is a dataset documentation task only.",
    "",
    "Inspect the mounted dataset exhaustively before writing:",
    "- Mounted files and directory structure.",
    "- Manifest files, source registries, table catalogs, README files, data dictionaries, normalization reports, and QA reports.",
    "- Parquet, CSV, JSON, DuckDB, and other stored data formats.",
    "- Table schemas, column types, units, nullable/null-share fields when available, primary keys, join keys, grains, and sample rows.",
    "- Source provenance, exact source URLs or API endpoints, direct/proxy/metadata-only status, license/access notes, fetch dates, row counts, and coverage.",
    "- Native and normalized time scales, first/last observations, update cadences, geography levels, crosswalks, transformations, derived fields, QA checks, limitations, and known gaps.",
    "",
    "Create these artifacts:",
    "1. Dataset Briefing — markdown document with these exact sections: Overview; Readiness & Trust; Data Inventory; Sources; Schemas; Time Coverage; Geography Coverage; Formats; Transformations & Derived Fields; Quality & Validation; Limitations & Known Gaps; Usable Next Steps.",
    "2. Dataset Profile — structured JSON backing data with summary, sources, tables, schemas/columns, timeCoverage, geographyCoverage, formats, transformations, quality, limitations, and generatedAt.",
    "",
    "Readiness & Trust must explicitly state whether the dataset is usable right now, what evidence supports that judgment, and what would make it unsafe or premature to use.",
    "Usable Next Steps must be limited to dataset-state actions such as inspect artifacts, fix missing sources, normalize a table, or run a clearly scoped analysis after approval; do not drift into generic research ideas.",
    "",
    "The briefing should be detailed enough that a reader can understand exactly what data exists, where it came from, what shape it is in, what caveats apply, and whether it is ready for research without opening the raw files.",
  ].join("\n");
}

export function createDefaultAgentRuntimeDeps(): AgentRuntimeDeps {
  return {
    createRemoteClient: (session) => new RemoteApiClient(session),
    readSession,
    login,
    createToolRegistry,
  };
}

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
  "describe_remote_dataset",
  "start_remote_agent_run",
  "continue_remote_agent_run",
  "run_remote_transformation",
  "run_remote_labeling",
  "create_public_data_environment",
  "create_research_environment",
]);

const AGENT_INSTRUCTIONS = [
  "You are RESEARCH, a dataset-backed research CLI for creating, inspecting, analyzing, and summarizing datasets.",
  "Explain the product in terms of datasets, analyses, results, and artifacts before mentioning cloud environments or run lifecycle details.",
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
  "Use user-facing language. Avoid raw tool names, internal lifecycle jargon, stack traces, or UUID-heavy output unless they are needed for an action.",
  "For broad orientation questions, answer with concrete dataset actions and example prompts; do not call tools.",
  "For local file import how-to questions without an exact path, ask for the absolute path and a one-line description before listing or importing datasets.",
  "For vague research prompts such as housing-market risk or what makes tweets viral, propose a scoped plan and ask for confirmation before starting a remote run.",
  "When recommending a dataset, anchor the answer to actual datasets found in RESEARCH before suggesting external sources.",
  "When resolving an ambiguous dataset name, state which dataset you selected and why.",
  "For field-definition questions, include a compact schema-evidence line and clearly distinguish stored fields from derived metrics.",
  "If deriving tweet quote counts, say: quote_count_for_tweet = count(rows where row.quoted_tweet_id == target.tweet_id). Never describe this as quoted_tweet_id == tweet_id on the same row.",
  "When a dataset is provisioning or busy, say what cannot happen yet, whether a new run was started, and give a concrete next command.",
  "When the user asks for the last run, distinguish latest active run from last completed run instead of blending them.",
  "For new environments that involve public internet/API sources, private/local files, paid exports, or any mix of sources, prefer create_research_environment.",
  "Before creating a research environment, list remote datasets and reuse or extend an existing semantically matching research environment when one exists. Do not create duplicate environments for the same domain, source catalog, or hypothesis family.",
  "Use create_public_data_environment only for simple public-only environments. Do not use deploy_remote_dataset unless there is one uploaded/local source that only needs normalization.",
  "For environment creation, make a concrete acquisition plan in the remote prompt: public sources, private files, APIs, files to fetch, normalized output tables, manifest, and validation checks.",
  "Prefer lightweight dataset queries before launching heavy transforms or analyses when the user is asking for examples, top records, or simple slices.",
  "Do not answer with generic numbered menus when you can inspect the user's actual datasets or runs and propose one concrete next action.",
  "When you start a remote run, do not wait for completion unless the user explicitly asks you to wait. Return immediately with the run id and dashboard link.",
  "If a waited-on remote run finishes as failed, cancelled, or errored, stop and report that run's diagnostics/results. Do not start a replacement run unless the user explicitly asks you to retry.",
  "When the user asks for run results, render them as a concise human-readable report. Do not dump raw JSON unless explicitly asked.",
  "For run results, explain artifacts as saved run outputs and tell the user to view them on the run page.",
  "For completed runs, give 2-3 concrete follow-up suggestions grounded in the result.",
  "When the user asks to describe, document, inventory, or inspect what is inside a remote dataset, use describe_remote_dataset. The describe run must produce dataset documentation artifacts and should not include query instructions or starter analyses.",
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
  if (isUncertainRunStatus(normalized)) return "unknown: worker state needs reconciliation";
  return status ?? "unknown";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function reusableEnvironmentTokens(value: string) {
  const stopWords = new Set([
    "a", "an", "and", "api", "catalog", "data", "dataset", "environment", "for", "from", "new", "of", "or",
    "public", "research", "source", "sources", "the", "to", "v1", "with",
  ]);
  return [...new Set(value.toLowerCase().split(/[^a-z0-9]+/u)
    .filter((token) => token.length >= 3 && !stopWords.has(token) && !/^\d+$/u.test(token)))];
}

function datasetReuseScore(requestedText: string, dataset: RemoteDatasetSummary) {
  if (dataset.status && !["ready", "deployed"].includes(dataset.status.toLowerCase())) {
    return 0;
  }
  const requested = new Set(reusableEnvironmentTokens(requestedText));
  if (requested.size === 0) return 0;
  const candidateText = [dataset.id, dataset.name].join(" ");
  const candidate = reusableEnvironmentTokens(candidateText);
  const overlap = candidate.filter((token) => requested.has(token));
  const readinessBonus = dataset.status?.toLowerCase() === "ready" ? 1 : 0;
  return overlap.length + readinessBonus;
}

function selectReusableEnvironmentDatasetId(
  requestedDatasetId: string,
  request: Record<string, unknown>,
  datasets: RemoteDatasetSummary[],
) {
  if (datasets.some((dataset) => dataset.id === requestedDatasetId && ["ready", "deployed"].includes((dataset.status ?? "").toLowerCase()))) {
    return requestedDatasetId;
  }
  const publicSources = Array.isArray(request.publicSources)
    ? request.publicSources.map((source) => isRecord(source) ? `${source.name ?? ""} ${source.url ?? ""}` : "").join(" ")
    : "";
  const requestedText = [
    requestedDatasetId,
    request.name,
    request.description,
    request.sourceDescription,
    publicSources,
  ].filter((value) => typeof value === "string").join(" ");
  const scored = datasets
    .map((dataset) => ({ dataset, score: datasetReuseScore(requestedText, dataset) }))
    .filter((entry) => entry.score >= 3)
    .sort((left, right) => right.score - left.score || String(right.dataset.createdAt ?? "").localeCompare(String(left.dataset.createdAt ?? "")));
  return scored[0]?.dataset.id ?? requestedDatasetId;
}

async function resolveRunnableEnvironmentDatasetId(
  context: ToolExecutionContext,
  client: RemoteApiClientType,
  requestedDatasetId: string,
  request: Record<string, unknown>,
) {
  const existingDatasets = typeof client.listDatasets === "function"
    ? await client.listDatasets().catch(() => ({ datasets: [] }))
    : { datasets: [] };
  const datasetId = selectReusableEnvironmentDatasetId(requestedDatasetId, request, existingDatasets.datasets);
  if (datasetId !== requestedDatasetId) {
    context.emit({ role: "tool", content: `Reusing existing research environment ${datasetId} instead of unavailable duplicate ${requestedDatasetId}.` });
  }
  return datasetId;
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
  return [
    "Blocked: dataset is already busy.",
    `Active run: ${runId}`,
    `Status: ${status}`,
    "",
    "No new run was started.",
    `Check it: research debug run ${runId}`,
    `Dashboard: ${dashboardRunUrl(DEFAULT_WEB_ORIGIN, runId)}`,
  ].join("\n");
}

function summarizeRemoteFailure(error: RemoteRequestError) {
  const payload = parseRemoteErrorJson(error);
  const rawMessage = typeof payload?.error === "string" ? payload.error : error.message;
  const isCapacity = error.status === 429 || /capacity|volume|limit|quota|too many/i.test(rawMessage);
  const lines = [
    "Blocked: remote request failed.",
    `What failed: ${error.path}`,
    `Status: ${error.status}`,
    "",
    isCapacity
      ? "The backend appears to be blocked by an infrastructure capacity or rate limit. No completed result is available from this attempt."
      : "The backend rejected the request before the CLI could finish the work.",
  ];
  if (isCapacity) {
    lines.push("Next: retry later, or ask an operator to inspect backend capacity before retrying.");
  } else {
    lines.push("Next: retry once, or run with debug diagnostics if it fails again.");
  }
  return lines.join("\n");
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
    const refreshed = await context.deps.readSession();
    if (refreshed?.accessToken && refreshed.accessToken !== context.session?.accessToken) {
      context.session = refreshed;
      return fn();
    }
    context.emit({ role: "tool", content: "Session expired. Opening login to refresh authentication." });
    const session = await context.deps.login({}, (message) => {
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
    const client = context.deps.createRemoteClient(context.session);
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
  return context.deps.createRemoteClient(requireSession(context));
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

function maybeHandleOrientation(input: string) {
  const lower = input.trim().toLowerCase();
  if (!/^(what can you help me do\??|help|what do you do\??)$/u.test(lower)) {
    return null;
  }
  return [
    "I help you turn files and datasets into research you can inspect, run, and review.",
    "",
    "Start here:",
    "- Show my datasets",
    "",
    "I can help you:",
    "- Create a dataset from /absolute/path/customers.csv",
    "- List datasets and inspect what each one contains",
    "- Brief a dataset before you trust or analyze it",
    "- Plan or run an analysis for a specific question",
    "- Show the latest results or saved files from earlier work",
    "",
    "Other useful prompts:",
    "- Brief the sales dataset",
    "- Test whether retention changed after launch",
    "- Show my latest analysis results",
  ].join("\n");
}

function maybeHandleCsvImportHowTo(input: string) {
  const lower = input.toLowerCase();
  if (!/\bcsv\b/.test(lower) || !/\b(desktop|downloads|local|my computer|file)\b/.test(lower) || !/\b(how|turn it|import|create|research here)\b/.test(lower)) {
    return null;
  }
  return [
    "I need the absolute path to the CSV and a one-line description of what it contains.",
    "",
    "Example:",
    "`/Users/ryanprendergast/Desktop/support_tickets.csv` — customer support tickets with timestamps, categories, priorities, and resolution status.",
    "",
    "Once you provide that, I can infer the schema, register the dataset, upload it, and deploy it for research. If you only know a hint, I can help narrow it down, but I still need the exact path before import.",
  ].join("\n");
}

function maybeHandleVagueMarketQuestion(input: string) {
  const lower = input.toLowerCase();
  if (!/\bhousing market\b/.test(lower) || !/\b(trouble|crash|bad|risk|look into)\b/.test(lower)) {
    return null;
  }
  return "Do you mean the U.S. housing market, and do you want a quick current-state read or a deeper risk analysis? I would look at affordability, prices, inventory, mortgage rates, delinquencies, employment, and regional differences once you choose the scope.";
}

function maybeHandleVagueTweetsExperiment(input: string) {
  const lower = input.toLowerCase();
  if (!/\btweets?\b/.test(lower) || !/\bviral|virality\b/.test(lower) || !/\b(experiment|run|analy[sz]e|look into)\b/.test(lower)) {
    return null;
  }
  if (/\btop\s*0\.1%|quote_tweet_count|sample\s+100|strict json\b/.test(lower)) {
    return null;
  }
  return [
    "Before I start a remote run, here is the experiment I would use.",
    "",
    "Dataset: `enriched-tweets`, if available, because it should contain tweet text, timestamps, authors, and engagement fields.",
    "Plan: define virality from available engagement counts, label `hook_type`, `emotional_tone`, and `controversy_level`, compare media or topic fields if present, and return a short summary with visualizations and representative examples.",
    "",
    "Confirm the scope: should I define viral tweets as the top 0.1% by quote/retweet/like engagement and sample 100 tweets for labeling?",
  ].join("\n");
}

function extractDatasetIdFromNewAnalysis(input: string) {
  const match = input.match(/\b(?:on|using)\s+([a-z0-9][a-z0-9_-]*)(?:[.\s]|$)/iu);
  return match?.[1] ?? null;
}

async function maybeHandleBusyDatasetBeforePlanning(input: string, initialSession: SessionRecord | null) {
  const lower = input.toLowerCase();
  if (!initialSession || !/\b(new analysis|run.*analysis|start.*analysis)\b/.test(lower)) {
    return null;
  }
  const datasetId = extractDatasetIdFromNewAnalysis(input);
  if (!datasetId) {
    return null;
  }
  const runs = await readTrackedRuns().catch(() => []);
  const active = runs.find((run) => run.datasetId === datasetId && !run.terminalAt && !isTerminalRunStatus(run.status));
  if (!active) {
    return null;
  }
  return [
    `Blocked: ${datasetId} is already busy.`,
    `Active run: ${active.id}`,
    `Status: ${active.status}`,
    "",
    "Starting a duplicate analysis is not allowed while that run holds the dataset.",
    `Check it: research debug run ${active.id}`,
    "Next: wait for it to finish, inspect it, or cancel it before starting a new analysis.",
  ].join("\n");
}

async function maybeHandleStuckRunQuestion(input: string, initialSession: SessionRecord | null) {
  const lower = input.toLowerCase();
  if (!initialSession || !/\blast run\b/.test(lower) || !/\b(stuck|happening|progress|status)\b/.test(lower)) {
    return null;
  }
  const runs = await readTrackedRuns().catch(() => []);
  const active = runs.find((run) => !run.terminalAt && !isTerminalRunStatus(run.status));
  if (!active) {
    return "I do not see an active tracked run right now. Ask `show results from my last run` to inspect the latest completed one.";
  }
  const updated = active.updatedAt ? new Date(active.updatedAt).getTime() : NaN;
  const minutes = Number.isFinite(updated) ? Math.max(0, Math.round((Date.now() - updated) / 60000)) : null;
  const heartbeat = minutes === null ? "unknown" : minutes <= 1 ? "under 1 minute ago" : `${minutes} minutes ago`;
  return [
    `Your run is still active, but its last update was ${heartbeat}.`,
    "",
    `Run: ${active.id}`,
    `Dataset: ${active.datasetId}`,
    `State: ${formatStatusForHumans(active.status)}`,
    active.prompt ? `Current work: ${active.prompt.split("\n")[0]?.slice(0, 120)}` : "Current work: remote processing",
    "",
    "Recommended next step: keep monitoring if this is a large dataset profile; debug now if the heartbeat looks stale for your workload.",
    `Debug: research debug run ${active.id}`,
  ].join("\n");
}

function progressLabel(toolName: string, input: Record<string, unknown>) {
  switch (toolName) {
    case "list_local_datasets":
      return "Checking local datasets...";
    case "list_remote_datasets":
      return "Checking remote datasets...";
    case "inspect_remote_dataset":
      return `Inspecting dataset ${String(input.datasetId ?? "").trim() || ""}...`.trim();
    case "describe_remote_dataset":
      return `Starting dataset briefing for ${String(input.datasetId ?? "").trim() || "dataset"}...`;
    case "list_tracked_runs":
      return "Checking run history...";
    case "get_run_results":
      return `Retrieving results for run ${String(input.runId ?? "").trim() || ""}...`.trim();
    case "start_remote_run":
    case "start_remote_agent_run":
    case "query_remote_dataset":
    case "aggregate_remote_dataset":
      return `Starting remote run for ${String(input.datasetId ?? "").trim() || "dataset"}...`;
    case "create_research_environment":
    case "create_public_data_environment":
      return "Starting dataset build...";
    case "resolve_local_dataset":
      return "Resolving local file...";
    case "register_remote_dataset":
      return "Creating dataset record...";
    case "request_dataset_source_upload":
      return "Preparing upload...";
    case "upload_local_file":
      return `Uploading ${basename(String(input.inputPath ?? "file"))}...`;
    case "complete_dataset_source_upload":
      return "Finalizing upload...";
    case "deploy_remote_dataset":
      return `Deploying ${String(input.datasetId ?? "").trim() || "dataset"}...`;
    default:
      return `Running ${toolName}...`;
  }
}

function shouldEchoToolResult(summary: string) {
  return !summary.startsWith("Blocked:");
}

export function createToolRegistry(): ToolDefinition[] {
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
      description: "List datasets registered on the remote Alpha Research control plane. Use this before creating a research environment so existing matching environments can be reused or extended instead of duplicated.",
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
      description: "Create or extend a remote research environment from public sources, private/local uploaded files, or a mix. This provisions a dataset volume, uploads local private sources when provided, and prompts a remote agent to fetch, stage, normalize, validate, and document all data. Prefer an existing semantically matching datasetId from list_remote_datasets when extending the same domain or source catalog.",
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
        const requestedDatasetId = String(input.datasetId);
        const existingDatasets = await client.listDatasets().catch(() => ({ datasets: [] }));
        const datasetId = selectReusableEnvironmentDatasetId(requestedDatasetId, input, existingDatasets.datasets);
        const name = String(input.name);
        const prompt = String(input.prompt);
        const publicSources = Array.isArray(input.publicSources)
          ? input.publicSources as Array<Record<string, unknown>>
          : [];
        const localPaths = Array.isArray(input.localPaths)
          ? input.localPaths.map((value) => String(value)).filter(Boolean)
          : [];
        if (datasetId === requestedDatasetId) {
          await client.createDataset({
            datasetId,
            name,
            sourceType: localPaths.length > 0 && (publicSources.length > 0 || input.sourceDescription) ? "mixed_data" : localPaths.length > 0 ? "private_data" : "public_data",
            sourceFilename: localPaths.length > 0 && (publicSources.length > 0 || input.sourceDescription) ? "mixed" : localPaths.length > 0 ? "private-uploads" : "internet",
            mode: "tabular",
            description: typeof input.description === "string" ? input.description : undefined,
          });
        } else {
          context.emit({ role: "tool", content: `Reusing existing research environment ${datasetId} instead of creating duplicate ${requestedDatasetId}.` });
        }
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
        let result;
        try {
          result = await client.createResearchEnvironment(datasetId, {
            name,
            description: typeof input.description === "string" ? input.description : undefined,
            sourceDescription: typeof input.sourceDescription === "string" ? input.sourceDescription : undefined,
            publicSources,
            privateSources,
            prompt,
            resources: STANDARD_ANALYSIS_RESOURCES,
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
          summary: `Started research environment build ${result.run.id} for ${datasetId}. Dashboard: ${dashboardRunUrl(requireSession(context).origin, result.run.id)}`,
          data: result,
        };
      },
    },
    {
      name: "create_public_data_environment",
      description: "Create or extend a remote research environment from public internet/API data by provisioning a dataset volume and prompting a remote agent to fetch, normalize, validate, and document the data. Prefer an existing semantically matching datasetId from list_remote_datasets when extending the same domain or source catalog.",
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
        const requestedDatasetId = String(input.datasetId);
        const existingDatasets = await client.listDatasets().catch(() => ({ datasets: [] }));
        const datasetId = selectReusableEnvironmentDatasetId(requestedDatasetId, input, existingDatasets.datasets);
        if (datasetId !== requestedDatasetId) {
          context.emit({ role: "tool", content: `Reusing existing research environment ${datasetId} instead of creating duplicate ${requestedDatasetId}.` });
        }
        const prompt = String(input.prompt);
        let result;
        try {
          result = await client.createPublicDataEnvironment(datasetId, {
            name: String(input.name),
            description: typeof input.description === "string" ? input.description : undefined,
            sourceDescription: String(input.sourceDescription),
            prompt,
            resources: STANDARD_ANALYSIS_RESOURCES,
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
        const datasetId = await resolveRunnableEnvironmentDatasetId(context, client, String(input.datasetId), input);
        const prompt = String(input.prompt);
        let result;
        try {
          result = await client.startRun(datasetId, withMountedDatasetGroundingPrompt(datasetId, prompt), {
            type: typeof input.type === "string" ? input.type : undefined,
            config: withStandardAnalysisResources(input.config && typeof input.config === "object" ? input.config as Record<string, unknown> : undefined, datasetId),
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
        const datasetId = await resolveRunnableEnvironmentDatasetId(context, client, String(input.datasetId), input);
        const prompt = String(input.prompt);
        let started;
        try {
          started = await withAuthRetry(context, () => client.startRun(datasetId, withMountedDatasetGroundingPrompt(datasetId, prompt), {
            type: "query",
            config: withStandardAnalysisResources(undefined, datasetId),
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
        const datasetId = await resolveRunnableEnvironmentDatasetId(context, client, String(input.datasetId), input);
        const prompt = String(input.prompt);
        let started;
        try {
          started = await withAuthRetry(context, () => client.startRun(datasetId, withMountedDatasetGroundingPrompt(datasetId, prompt), {
            type: "query",
            config: withStandardAnalysisResources(undefined, datasetId),
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
        const sourceDescription = String(input.sourceDescription);
        const client = createRemoteClient(context);
        const datasetId = await resolveRunnableEnvironmentDatasetId(context, client, String(input.datasetId), input);
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
            ? isUncertainRunStatus(waited.run?.status)
              ? `Run ${String(input.runId)} is ${waited.run?.status ?? "unknown"}; worker state needs backend reconciliation before this should be treated as success or product failure.`
              : `Run ${String(input.runId)} finished with status ${waited.run?.status ?? "unknown"}.`
            : `Run ${String(input.runId)} is still ${waited.run?.status ?? "running"}.`,
          data: waited,
        };
      },
    },
    {
      name: "describe_remote_dataset",
      description: "Start a remote Codex CLI describe run that generates durable dataset documentation artifacts: a human Dataset Briefing markdown document and structured Dataset Profile JSON. Use this when the user wants to describe, document, inventory, or inspect what data, sources, schemas, time scales, formats, QA status, and limitations exist in a dataset.",
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
        const datasetId = await resolveRunnableEnvironmentDatasetId(context, client, String(input.datasetId), input);
        let result;
        try {
          result = await withAuthRetry(context, () => client.startRun(
            datasetId,
            withMountedDatasetGroundingPrompt(datasetId, datasetBriefingPrompt(datasetId)),
            {
              type: "describe",
              config: withStandardAnalysisResources({ describeDataset: true }, datasetId),
              artifacts: [...DATASET_BRIEFING_ARTIFACTS],
            },
          ));
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
            prompt: result.run.prompt ?? datasetBriefingPrompt(datasetId),
            createdAt: result.run.createdAt,
            updatedAt: result.run.updatedAt,
          });
          spawnRunWatcher(result.run.id);
        }
        return {
          summary: `Started dataset briefing run ${result.run.id} for ${datasetId}. Dashboard: ${dashboardRunUrl(requireSession(context).origin, result.run.id)}`,
          data: result,
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
        const datasetId = await resolveRunnableEnvironmentDatasetId(context, client, String(input.datasetId), input);
        let result;
        try {
          result = await client.startRun(datasetId, withMountedDatasetGroundingPrompt(datasetId, String(input.prompt)), {
            type: "agent",
            config: withStandardAnalysisResources(undefined, datasetId),
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
          return {
            summary: `Run ${String(input.runId)} does not have a resumable remote agent session. Use the saved run artifacts or start a new run for follow-up work.`,
            data: {
              ok: false,
              reason: "not_resumable",
              run: previous.run,
              artifacts: previous.artifacts.filter(isProducedArtifact),
            },
          };
        }
        let result;
        try {
          result = await client.startRun(previous.run.datasetId, withMountedDatasetGroundingPrompt(previous.run.datasetId, String(input.prompt)), {
            type: "agent",
            config: withStandardAnalysisResources({ remoteAgentSessionId: sessionId, parentRunId: String(input.runId) }, previous.run.datasetId),
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
        const datasetId = await resolveRunnableEnvironmentDatasetId(context, client, String(input.datasetId), input);
        let result;
        try {
          result = await client.startRun(datasetId, withMountedDatasetGroundingPrompt(datasetId, String(input.prompt)), {
            type: "transform",
            config: withStandardAnalysisResources({
              scriptOutline: typeof input.scriptOutline === "string" ? input.scriptOutline : undefined,
            }, datasetId),
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
        const datasetId = await resolveRunnableEnvironmentDatasetId(context, client, String(input.datasetId), input);
        let result;
        try {
          result = await client.startRun(
            datasetId,
            withMountedDatasetGroundingPrompt(datasetId, typeof input.prompt === "string" ? input.prompt : `Run labeling job: ${labelingPrompt}`),
            {
              type: "label",
              config: withStandardAnalysisResources({ labelingPrompt }, datasetId),
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

export function getToolRegistryMetadata(): ToolRegistryMetadata[] {
  return createToolRegistry().map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    asyncRunStart: ASYNC_RUN_START_TOOLS.has(tool.name),
  }));
}

export function validateToolRegistry(tools: ToolDefinition[] = createToolRegistry()) {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const tool of tools) {
    if (!tool.name || !/^[a-z][a-z0-9_]*$/u.test(tool.name)) {
      errors.push(`Invalid tool name: ${tool.name || "<empty>"}`);
    }
    if (seen.has(tool.name)) {
      errors.push(`Duplicate tool name: ${tool.name}`);
    }
    seen.add(tool.name);
    if (!tool.description || tool.description.trim().length < 20) {
      errors.push(`Tool ${tool.name} needs a concise description.`);
    }
    if (!isRecord(tool.inputSchema) || tool.inputSchema.type !== "object") {
      errors.push(`Tool ${tool.name} must use an object JSON schema.`);
    }
    try {
      JSON.stringify(buildToolSchema(tool));
    } catch {
      errors.push(`Tool ${tool.name} schema is not JSON serializable.`);
    }
  }
  return {
    ok: errors.length === 0,
    errors,
    tools: tools.map((tool) => tool.name),
  };
}

export async function runAgentTurn(
  input: string,
  initialSession: SessionRecord | null,
  emit: (message: AgentMessage) => void,
  conversationState?: AgentConversationState,
  deps: AgentRuntimeDeps = createDefaultAgentRuntimeDeps(),
): Promise<AgentConversationState> {
  const directResponse = maybeHandleOrientation(input)
    ?? maybeHandleCsvImportHowTo(input)
    ?? maybeHandleVagueMarketQuestion(input)
    ?? maybeHandleVagueTweetsExperiment(input);
  if (directResponse) {
    emit({ role: "assistant", content: directResponse });
    return {
      sessionId: conversationState?.sessionId ?? null,
      previousResponseId: conversationState?.previousResponseId ?? null,
    };
  }

  const localRunResponse = await maybeHandleStuckRunQuestion(input, initialSession)
    ?? await maybeHandleBusyDatasetBeforePlanning(input, initialSession);
  if (localRunResponse) {
    emit({ role: "assistant", content: localRunResponse });
    return {
      sessionId: conversationState?.sessionId ?? null,
      previousResponseId: conversationState?.previousResponseId ?? null,
    };
  }

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
  const toolRegistry = deps.createToolRegistry().filter((tool) => {
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
    deps,
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
  let response: ResponsesApiPayload;
  try {
    response = await withAuthRetry(context, async () => {
      const activeClient = deps.createRemoteClient(requireSession(context));
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
  } catch (error) {
    if (error instanceof RemoteRequestError) {
      emit({ role: "assistant", content: summarizeRemoteFailure(error) });
      return {
        sessionId: context.sessionId,
        previousResponseId: conversationState?.previousResponseId ?? null,
      };
    }
    throw error;
  }

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
      const parsedArguments = parseJsonArguments(call.arguments);
      emit({ role: "tool", content: progressLabel(tool.name, parsedArguments) });
      await persistSessionEntry(context, {
        role: "tool",
        kind: "tool_call",
        title: tool.name,
        content: progressLabel(tool.name, parsedArguments),
        metadata: { name: tool.name, arguments: parsedArguments },
      });
      let result: AgentToolResult;
      try {
        result = await withAuthRetry(context, () => tool.execute(context, parsedArguments));
      } catch (error) {
        if (error instanceof RemoteRequestError) {
          const summary = summarizeRemoteFailure(error);
          emit({ role: "assistant", content: summary });
          await persistSessionEntry(context, {
            role: "assistant",
            kind: "local_summary",
            title: "CLI blocked",
            content: summary,
          });
          return {
            sessionId: context.sessionId,
            previousResponseId: conversationState?.previousResponseId ?? null,
          };
        }
        throw error;
      }
      if (shouldEchoToolResult(result.summary)) {
        emit({ role: "tool", content: result.summary });
      }
      await persistSessionEntry(context, {
        role: "tool",
        kind: "tool_result",
        title: tool.name,
        content: result.summary,
        metadata: { name: tool.name, data: result.data },
      });
      if (ASYNC_RUN_START_TOOLS.has(tool.name) && !exposeWaitTool) {
        const resultData = isRecord(result.data) ? result.data : {};
        const startedRunId = isRecord(resultData.run) && typeof resultData.run.id === "string" ? resultData.run.id : null;
        const finalSummary =
          context.session && context.sessionId && startedRunId
            ? `${result.summary}\nTerminal session: ${dashboardTerminalSessionUrl(context.session.origin, context.sessionId, startedRunId)}`
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

    const refreshedSession = await deps.readSession();
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
      const activeClient = deps.createRemoteClient(requireSession(context));
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
