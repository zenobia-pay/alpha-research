import { access, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";

import { getInstanceBootstrap, listInstanceBundles, type DatasetInstanceSummary } from "@rprend/alpha-storage";

import { DEFAULT_INSTANCE_ROOT, DEFAULT_WEB_ORIGIN, dashboardRunUrl, dashboardTerminalSessionUrl, type SessionRecord } from "./config.js";
import { inferDatasetDefaults, inferDatasetIngestFlags, inspectLocalDatasetFile, uploadFileToPresignedUrl } from "./local-tools.js";
import {
  RemoteApiClient,
  RemoteRequestError,
  type RemoteApiClient as RemoteApiClientType,
  type RemoteDatasetDetail,
  type RemoteDatasetSummary,
  type RemoteRunArtifact,
} from "./remote.js";
import { readSession, login } from "./session.js";
import {
  isTerminalRunFailureStatus,
  isTerminalRunStatus,
  isTerminalRunSuccessStatus,
  isUncertainRunStatus,
  readTrackedRuns,
  spawnRunWatcher,
  trackRemoteRun,
  type TrackedRunRecord,
} from "./runs.js";

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
  readTrackedRuns: typeof readTrackedRuns;
  now: () => number;
  listLocalDatasets: () => Promise<DatasetInstanceSummary[]>;
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
    readTrackedRuns,
    now: () => Date.now(),
    listLocalDatasets: () => listInstanceBundles(DEFAULT_INSTANCE_ROOT),
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
  "deploy_remote_dataset",
  "deploy_local_instance",
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
  "For dataset-choice questions such as which dataset should I use, call list_remote_datasets with the user's topic, show a ranked shortlist of 2-3 real datasets when available, and say explicitly why the top choice beat the alternatives.",
  "For dataset-choice answers, separate recommendation state from future build work. Use concise sections in this order: Recommendation ready or Need clarifications to finalize, Best existing dataset, Why it wins, What's missing, Questions needed.",
  "If an existing dataset is a usable base but still needs extension, say that explicitly as best current match. Do not lead with a source-acquisition plan before the user answers the remaining clarifying questions.",
  "When resolving an ambiguous dataset name, state which dataset you selected and why.",
  "For field-definition questions, answer the concept question before proposing any work.",
  "For field-definition questions, include a compact schema-evidence line and clearly distinguish stored fields from derived metrics.",
  "If you verified the field from dataset metadata, say so plainly. If you did not verify it, say that the answer is based on a common schema pattern; do not use vague labels like 'typical' without saying what is uncertain.",
  "For field-definition questions about research suitability, lead with a one-line verdict, then one short caveat.",
  "For field-definition questions, do not include composite formulas, top-N proposals, or offers to start analysis unless the user explicitly asks for analysis work.",
  "For field-definition questions, keep the answer concise and terminal-friendly; avoid long wrapped field lists.",
  "If deriving tweet quote counts, say: quote_count_for_tweet = count(rows where row.quoted_tweet_id == target.tweet_id). Never describe this as quoted_tweet_id == tweet_id on the same row.",
  "When a dataset is provisioning or busy, say what cannot happen yet, whether a new run was started, and give a concrete next command.",
  "When the user asks for the last run, distinguish latest active run from last completed run instead of blending them.",
  "For new environments that involve public internet/API sources, private/local files, paid exports, or any mix of sources, prefer create_research_environment.",
  "Before creating a research environment, list remote datasets and reuse or extend an existing semantically matching research environment when one exists. Do not create duplicate environments for the same domain, source catalog, or hypothesis family.",
  "Use create_public_data_environment only for simple public-only environments. Do not use deploy_remote_dataset unless there is one uploaded/local source that only needs normalization.",
  "For environment creation, make a concrete acquisition plan in the remote prompt: public sources, private files, APIs, files to fetch, normalized output tables, manifest, and validation checks.",
  "For fully specified dataset-build briefs that already name scope, time range, source families, validation checks, and requested artifacts, do not ask broad follow-up questions and do not inspect candidate datasets before launch unless readiness is genuinely unclear.",
  "For those explicit build briefs, list remote datasets once, reuse or extend the best matching environment if it exists, then launch create_research_environment immediately with a concise justification, preserved validation requirements, and explicit artifact expectations.",
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

type DatasetInventoryEntry = {
  id: string;
  name: string;
  scope: "local" | "remote";
  state: "ready" | "draft" | "building" | "deployable";
  description: string | null;
  hidden: boolean;
};

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

function formatIsoTimestamp(timestamp: string | undefined) {
  if (!timestamp) return null;
  const value = new Date(timestamp);
  if (Number.isNaN(value.getTime())) return null;
  return value.toISOString();
}

function formatRelativeAge(timestamp: string | undefined) {
  if (!timestamp) return null;
  const ageMs = Date.now() - new Date(timestamp).getTime();
  if (!Number.isFinite(ageMs)) return null;
  const ageMinutes = Math.max(0, Math.round(ageMs / 60000));
  if (ageMinutes < 1) return "under 1 minute ago";
  if (ageMinutes === 1) return "1 minute ago";
  if (ageMinutes < 60) return `${ageMinutes} minutes ago`;
  const ageHours = Math.round(ageMinutes / 60);
  if (ageHours === 1) return "1 hour ago";
  if (ageHours < 48) return `${ageHours} hours ago`;
  const ageDays = Math.round(ageHours / 24);
  return ageDays === 1 ? "1 day ago" : `${ageDays} days ago`;
}

function explainBlockingRunStatus(status: string | undefined, updatedAt: string | undefined) {
  const normalized = (status ?? "").toLowerCase();
  const ageMinutes = updatedAt ? Math.max(0, Math.round((Date.now() - new Date(updatedAt).getTime()) / 60000)) : null;
  if (normalized === "booting") {
    if (ageMinutes !== null && ageMinutes >= 10) {
      return "The run is still booting and holding the dataset lock. That is normal briefly, but this age may indicate a stuck startup worth inspecting.";
    }
    return "The run is booting and holding the dataset lock. That is expected while the worker starts.";
  }
  if (normalized === "queued") {
    return "The run is queued and already owns the dataset lock, so no competing analysis can start until it advances or is cancelled.";
  }
  if (normalized === "running") {
    return "The run is actively using the dataset, so starting another analysis would create competing work.";
  }
  if (isUncertainRunStatus(normalized)) {
    return "The run state needs reconciliation, so the dataset remains blocked until the backend confirms whether the lock can be released.";
  }
  return "The active run still holds the dataset lock, so no new analysis was started.";
}

function renderBusyDatasetConflict(details: {
  datasetId?: string;
  runId: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  dashboardUrl?: string;
}) {
  const startedAt = formatIsoTimestamp(details.createdAt);
  const updatedAt = formatIsoTimestamp(details.updatedAt);
  const startedAge = formatRelativeAge(details.createdAt);
  const updatedAge = formatRelativeAge(details.updatedAt);
  const lines = [
    details.datasetId
      ? `Blocked: ${details.datasetId} is already busy.`
      : "Blocked: dataset is already busy.",
    "",
    `Active run: ${details.runId}`,
    `Status: ${details.status}`,
  ];
  if (startedAt) {
    lines.push(`Started: ${startedAt}${startedAge ? ` (${startedAge})` : ""}`);
  }
  if (updatedAt) {
    lines.push(`Last update: ${updatedAt}${updatedAge ? ` (${updatedAge})` : ""}`);
  }
  lines.push(
    "",
    "No new run was started.",
    explainBlockingRunStatus(details.status, details.updatedAt),
    "",
    "Next steps:",
    `- Inspect now: \`research debug run ${details.runId}\``,
  );
  if (details.dashboardUrl) {
    lines.push(`- Open dashboard: ${details.dashboardUrl}`);
  }
  lines.push("- Wait for the active run to finish, or cancel it if you confirm it is stuck.");
  return lines.join("\n");
}

function formatDatasetLifecycleLabel(status: string | undefined, deploymentStatus?: string | undefined) {
  const normalized = (status ?? "").toLowerCase();
  const deployment = (deploymentStatus ?? "").toLowerCase();
  if (normalized === "ready" || deployment === "ready" || deployment === "deployed") {
    return "ready to use";
  }
  if (normalized === "uploading") {
    return "uploading";
  }
  if (deployment === "deploying" || normalized === "deploying") {
    return "deploying";
  }
  if (normalized === "provisioning" || normalized === "building" || normalized === "booting") {
    return "still being prepared";
  }
  if (normalized === "draft") {
    return "still a draft";
  }
  if (normalized === "uploaded" || deployment === "uploaded") {
    return "uploaded but not queryable yet";
  }
  if (normalized === "deployed") {
    return "ready to query";
  }
  return status?.trim() || "status unknown";
}

function inferDatasetActionLabel(kind: "local" | "remote", ready: boolean) {
  if (!ready) {
    return "not ready yet";
  }
  return kind === "local" ? "use locally" : "query remotely";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNoisyDatasetName(value: string) {
  return /\b(test|smoke|draft|upload|fixture|demo|tmp|sample)\b/i.test(value);
}

function inferDatasetPurpose(name: string, description?: string | null) {
  const trimmedDescription = description?.trim();
  if (trimmedDescription) {
    return trimmedDescription;
  }
  const lower = name.toLowerCase();
  if (/\btweets?\b/.test(lower)) {
    return "tweet archive for social/content analysis";
  }
  if (/\becon|econom/.test(lower)) {
    return "economic indicators and trend analysis";
  }
  if (/\bhousing|home values?\b/.test(lower)) {
    return "housing market and home-value analysis";
  }
  return "general research dataset";
}

type InventoryDatasetCard = {
  kind: "local" | "remote";
  id: string;
  name: string;
  purpose: string;
  readiness: string;
  action: string;
  ready: boolean;
  noisy: boolean;
  detail: string | null;
};

function localInventoryCard(instance: DatasetInstanceSummary): InventoryDatasetCard {
  return {
    kind: "local",
    id: instance.datasetId,
    name: instance.displayName,
    purpose: inferDatasetPurpose(instance.displayName, instance.description),
    readiness: "ready to use",
    action: inferDatasetActionLabel("local", true),
    ready: true,
    noisy: isNoisyDatasetName(`${instance.datasetId} ${instance.displayName}`),
    detail: `${formatNumber(instance.recordCount)} rows`,
  };
}

function remoteInventoryCard(dataset: RemoteDatasetSummary): InventoryDatasetCard {
  const status = (dataset.status ?? "").toLowerCase();
  const deployment = (dataset.deploymentStatus ?? "").toLowerCase();
  const ready = status === "ready" || deployment === "ready" || deployment === "deployed";
  return {
    kind: "remote",
    id: dataset.id,
    name: dataset.name?.trim() || dataset.id,
    purpose: inferDatasetPurpose(dataset.name?.trim() || dataset.id),
    readiness: formatDatasetLifecycleLabel(dataset.status, dataset.deploymentStatus),
    action: inferDatasetActionLabel("remote", ready),
    ready,
    noisy: isNoisyDatasetName(`${dataset.id} ${dataset.name ?? ""}`),
    detail: ready ? "deployed" : null,
  };
}

function inventorySort(left: InventoryDatasetCard, right: InventoryDatasetCard) {
  if (left.ready !== right.ready) return left.ready ? -1 : 1;
  if (left.noisy !== right.noisy) return left.noisy ? 1 : -1;
  if (left.kind !== right.kind) return left.kind === "local" ? -1 : 1;
  return left.name.localeCompare(right.name);
}

function chooseRecommendedInventoryDataset(cards: InventoryDatasetCard[]) {
  const ranked = [...cards].sort((left, right) => {
    const leftScore = (left.ready ? 100 : 0) + (left.noisy ? 0 : 10) + (left.kind === "local" ? 2 : 1);
    const rightScore = (right.ready ? 100 : 0) + (right.noisy ? 0 : 10) + (right.kind === "local" ? 2 : 1);
    return rightScore - leftScore || inventorySort(left, right);
  });
  return ranked[0] ?? null;
}

function renderInventoryDatasetLine(card: InventoryDatasetCard) {
  const meta = [card.kind, card.readiness, card.detail].filter((value): value is string => Boolean(value)).join(" · ");
  const purpose = card.purpose === "general research dataset" ? "" : ` · ${card.purpose}`;
  return `- ${card.name} (${meta})${purpose}`;
}

function formatDatasetInventoryResponse(
  localInstances: DatasetInstanceSummary[],
  remoteDatasets: RemoteDatasetSummary[],
  includeHidden = false,
) {
  const cards = [
    ...localInstances.map(localInventoryCard),
    ...remoteDatasets.map(remoteInventoryCard),
  ].sort(inventorySort);
  const visibleCards = includeHidden ? cards : cards.filter((card) => !card.noisy);
  const hiddenCount = cards.length - visibleCards.length;
  const readyChoices = visibleCards.filter((card) => card.ready);
  const otherChoices = visibleCards.filter((card) => !card.ready);
  const recommendationPool = readyChoices.length > 0 ? readyChoices : (visibleCards.length > 0 ? visibleCards : cards);
  const recommendation = chooseRecommendedInventoryDataset(recommendationPool);
  const shownOtherChoices = otherChoices.slice(0, 4);
  const omittedOtherChoices = otherChoices.length - shownOtherChoices.length;
  const readyCount = cards.filter((card) => card.ready).length;
  const lines: string[] = [];

  lines.push(`Inventory: ${localInstances.length} local, ${remoteDatasets.length} remote, ${readyCount} ready now.`);

  if (recommendation) {
    lines.push(
      "",
      "Recommended",
      `- ${recommendation.name} (${recommendation.kind} · ${recommendation.readiness}${recommendation.detail ? ` · ${recommendation.detail}` : ""})`,
    );
    if (recommendation.purpose !== "general research dataset") {
      lines.push(`  ${recommendation.purpose}`);
    }
    lines.push(`  Next: ask \`describe ${recommendation.id}\` to inspect it, or \`analyze ${recommendation.id}\` to start work.`);
  }

  if (readyChoices.length > 0) {
    lines.push("", "Ready now");
    for (const card of readyChoices) {
      lines.push(renderInventoryDatasetLine(card));
    }
  } else {
    lines.push("", "Ready now", "- No datasets are ready to use yet.");
  }

  if (otherChoices.length > 0) {
    lines.push("", "Other datasets");
    for (const card of shownOtherChoices) {
      lines.push(renderInventoryDatasetLine(card));
    }
    if (omittedOtherChoices > 0) {
      lines.push(`- ${omittedOtherChoices} more dataset${omittedOtherChoices === 1 ? "" : "s"}. Ask \`show all datasets\` to expand this list.`);
    }
  }

  if (hiddenCount > 0 && !includeHidden) {
    lines.push("", `Hidden ${hiddenCount} likely test or temporary datasets. Ask \`show all datasets\` to include them.`);
  }

  lines.push(
    "",
    "Legend: local = available in this CLI now. remote = ready on the hosted backend.",
    "Done. Inventory complete and ready for your next command.",
  );
  return lines.join("\n");
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

function topicRecommendationTokens(value: string) {
  const synonyms = new Map<string, string>([
    ["home", "housing"],
    ["homes", "housing"],
    ["rent", "rental"],
    ["rents", "rental"],
    ["renters", "rental"],
    ["affordable", "affordability"],
    ["prices", "price"],
    ["counties", "county"],
  ]);
  return [...new Set(value.toLowerCase().split(/[^a-z0-9]+/u)
    .map((token) => synonyms.get(token) ?? token)
    .filter((token) => token.length >= 3 && !/^\d+$/u.test(token)))];
}

function recommendationMatchScore(topic: string, dataset: RemoteDatasetSummary) {
  const requested = new Set(topicRecommendationTokens(topic));
  if (requested.size === 0) return 0;
  const candidate = topicRecommendationTokens([dataset.id, dataset.name].join(" "));
  const overlap = candidate.filter((token) => requested.has(token));
  if (overlap.length === 0) {
    return 0;
  }
  const readyBonus = ["ready", "deployed"].includes((dataset.status ?? dataset.deploymentStatus ?? "").toLowerCase()) ? 2 : 0;
  return overlap.length * 3 + readyBonus;
}

function recommendationReason(topic: string, dataset: RemoteDatasetSummary) {
  const requested = new Set(topicRecommendationTokens(topic));
  const candidate = topicRecommendationTokens([dataset.id, dataset.name].join(" "));
  const overlap = candidate.filter((token) => requested.has(token));
  if (overlap.length > 0) {
    return `matching topic terms: ${overlap.slice(0, 3).join(", ")}`;
  }
  if (["ready", "deployed"].includes((dataset.status ?? dataset.deploymentStatus ?? "").toLowerCase())) {
    return "ready environment that can be extended";
  }
  return "available but weak topical signal";
}

function rankDatasetsForRecommendation(topic: string, datasets: RemoteDatasetSummary[], limit = 3) {
  const ranked = datasets
    .map((dataset) => ({
      dataset,
      score: recommendationMatchScore(topic, dataset),
      reason: recommendationReason(topic, dataset),
    }))
    .sort((left, right) =>
      right.score - left.score
      || String(right.dataset.createdAt ?? "").localeCompare(String(left.dataset.createdAt ?? ""))
      || left.dataset.id.localeCompare(right.dataset.id));
  const meaningful = ranked.filter((entry) => entry.score > 0);
  if (meaningful.length > 0) {
    return meaningful.slice(0, Math.max(1, limit));
  }
  return ranked.slice(0, 1);
}

function formatDatasetShortlist(topic: string, datasets: RemoteDatasetSummary[], limit = 3) {
  const ranked = rankDatasetsForRecommendation(topic, datasets, limit);
  if (ranked.length === 0) return null;
  return ranked.map(({ dataset, score, reason }, index) => {
    const status = dataset.status ?? dataset.deploymentStatus ?? "unknown";
    return `${index + 1}. ${dataset.id} (${status}, score ${score}) — ${reason}`;
  }).join("\n");
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

async function resolveRunnableEnvironmentDataset(
  context: ToolExecutionContext,
  client: RemoteApiClientType,
  requestedDatasetId: string,
  request: Record<string, unknown>,
) : Promise<ResolvedDatasetTarget> {
  const existingDatasets = typeof client.listDatasets === "function"
    ? await client.listDatasets().catch(() => ({ datasets: [] }))
    : { datasets: [] };
  const datasetId = selectReusableEnvironmentDatasetId(requestedDatasetId, request, existingDatasets.datasets);
  const matchedDataset = existingDatasets.datasets.find((dataset) => dataset.id === datasetId);
  return {
    requestedDatasetId,
    datasetId,
    datasetName: matchedDataset?.name,
    reusedExisting: datasetId !== requestedDatasetId,
  };
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

function shortenRunId(runId: string) {
  return runId.length > 8 ? `${runId.slice(0, 4)}…${runId.slice(-4)}` : runId;
}

function summarizePromptForHumans(prompt: string | undefined, datasetId: string) {
  const firstLine = prompt?.split("\n").map((line) => line.trim()).find(Boolean) ?? "";
  const cleaned = firstLine
    .replace(/[`"'"]/g, "")
    .replace(/^mounted dataset grounding is mandatory.*$/i, "")
    .replace(/^describe dataset\s+/i, "Describe ")
    .trim();
  if (cleaned) {
    return cleaned.endsWith(".") ? cleaned : `${cleaned}.`;
  }
  return `Recent work on ${datasetId}.`;
}

function continuityArtifactLabel(artifact: { title?: string; type?: string }) {
  const title = typeof artifact.title === "string" && artifact.title.trim() ? artifact.title.trim() : artifact.type ?? "artifact";
  if (artifact.type === "structured_result" || title === "result.json") return "result.json";
  if (title.endsWith(".md")) return title;
  return title;
}

function summarizeContinuityArtifacts(artifacts: RemoteRunArtifact[]) {
  const produced = artifacts.filter(isProducedArtifact);
  if (produced.length === 0) {
    return {
      count: 0,
      line: "No user-facing artifacts yet.",
      bestArtifact: null as string | null,
    };
  }
  const preferred = produced
    .filter((artifact) => artifact.type !== "remote_agent_transcript" && artifact.type !== "remote_agent_session")
    .map(continuityArtifactLabel);
  const labels = [...new Set((preferred.length > 0 ? preferred : produced.map(continuityArtifactLabel)).filter(Boolean))];
  const bestArtifact = labels[0] ?? null;
  if (labels.length === 1) {
    return { count: produced.length, line: `Best artifact: ${labels[0]}.`, bestArtifact };
  }
  if (labels.length === 2) {
    return { count: produced.length, line: `Best artifacts: ${labels[0]} and ${labels[1]}.`, bestArtifact };
  }
  return { count: produced.length, line: `Best artifacts: ${labels.slice(0, 3).join(", ")}.`, bestArtifact };
}

function continuityLifecycle(run: TrackedRunRecord) {
  if (!isTerminalRunStatus(run.status)) return "active" as const;
  if (isTerminalRunSuccessStatus(run.status)) return "completed" as const;
  if (isUncertainRunStatus(run.status)) return "blocked" as const;
  if (isTerminalRunFailureStatus(run.status)) return "failed" as const;
  if (["cancelled", "canceled"].includes(run.status.toLowerCase())) return "failed" as const;
  return "failed" as const;
}

function pickRelevantContinuityRun(runs: TrackedRunRecord[]) {
  const completed = runs.find((run) => continuityLifecycle(run) === "completed");
  if (completed) return completed;
  const active = runs.find((run) => continuityLifecycle(run) === "active");
  if (active) return active;
  return runs[0] ?? null;
}

async function maybeHandleContinuityQuestion(
  input: string,
  initialSession: SessionRecord | null,
  deps: AgentRuntimeDeps,
) {
  const lower = input.toLowerCase();
  if (!initialSession) {
    return null;
  }
  const asksForContinuity = (
    /came back|back later|return later|returned later|later\b/.test(lower)
    || /my research work|recent work/.test(lower)
    || (/what happened/.test(lower) && /research|run|work/.test(lower))
  );
  const asksForStateOrOutputs = /what happened|results?|artifacts?|can i see|show me/.test(lower);
  if (!(asksForContinuity && asksForStateOrOutputs)) {
    return null;
  }

  const runs = await deps.readTrackedRuns().catch(() => []);
  if (runs.length === 0) {
    return "I do not see any tracked research work yet. Ask me to show datasets, start a run, or inspect a dataset first.";
  }

  const active = runs.filter((run) => continuityLifecycle(run) === "active");
  const completed = runs.filter((run) => continuityLifecycle(run) === "completed");
  const blocked = runs.filter((run) => continuityLifecycle(run) === "blocked");
  const failed = runs.filter((run) => continuityLifecycle(run) === "failed");
  const relevant = pickRelevantContinuityRun(runs);
  if (!relevant) {
    return "I could not determine a recent run to summarize.";
  }

  const client = deps.createRemoteClient(initialSession);
  let relevantResults: Awaited<ReturnType<RemoteApiClientType["getRunResults"]>> | null = null;
  if (continuityLifecycle(relevant) === "completed") {
    relevantResults = await client.getRunResults(relevant.id).catch(() => null);
  }

  const lines: string[] = [];
  const topLineParts = [
    active.length > 0 ? `${active.length} active` : null,
    completed.length > 0 ? `${completed.length} completed` : null,
    blocked.length > 0 ? `${blocked.length} blocked` : null,
    failed.length > 0 ? `${failed.length} failed` : null,
  ].filter((value): value is string => Boolean(value));
  lines.push(`I found ${topLineParts.join(", ")} run${runs.length === 1 ? "" : "s"} in your recent work.`);

  const relevantPrompt = summarizePromptForHumans(relevantResults?.run.prompt ?? relevant.prompt, relevant.datasetId);
  if (continuityLifecycle(relevant) === "completed" && relevantResults) {
    const artifactSummary = summarizeContinuityArtifacts(relevantResults.artifacts);
    lines.push(
      "",
      `Most relevant result: ${relevant.datasetId} (${shortenRunId(relevant.id)}) finished successfully.`,
      `What it was doing: ${relevantPrompt}`,
      artifactSummary.line,
      `Open in dashboard: ${dashboardRunUrl(initialSession.origin, relevant.id)}`,
    );
  } else if (continuityLifecycle(relevant) === "active") {
    lines.push(
      "",
      `Most relevant run: ${relevant.datasetId} (${shortenRunId(relevant.id)}) is still ${formatStatusForHumans(relevant.status)}.`,
      `What it is doing: ${relevantPrompt}`,
      "No finished artifacts from that run yet.",
    );
  } else if (continuityLifecycle(relevant) === "blocked") {
    lines.push(
      "",
      `Most relevant run: ${relevant.datasetId} (${shortenRunId(relevant.id)}) is blocked.`,
      `What it was doing: ${relevantPrompt}`,
      "The worker state needs reconciliation before new results will appear.",
    );
  } else {
    lines.push(
      "",
      `Most relevant run: ${relevant.datasetId} (${shortenRunId(relevant.id)}) ended ${formatStatusForHumans(relevant.status)}.`,
      `What it was doing: ${relevantPrompt}`,
      "That run did not finish cleanly.",
    );
  }

  if (active.length > 0) {
    lines.push("", "Active");
    for (const run of active.slice(0, 2)) {
      lines.push(`- ${run.datasetId} (${shortenRunId(run.id)}): ${summarizePromptForHumans(run.prompt, run.datasetId)}`);
    }
  }

  if (completed.length > 0) {
    lines.push("", "Completed");
    for (const run of completed.slice(0, 2)) {
      if (run.id === relevant.id && relevantResults) {
        const artifactSummary = summarizeContinuityArtifacts(relevantResults.artifacts);
        lines.push(`- ${run.datasetId} (${shortenRunId(run.id)}): ${artifactSummary.bestArtifact ? `${artifactSummary.bestArtifact} available.` : "Finished with saved artifacts."}`);
      } else {
        lines.push(`- ${run.datasetId} (${shortenRunId(run.id)}): finished successfully.`);
      }
    }
  }

  if (blocked.length > 0) {
    lines.push("", "Blocked");
    for (const run of blocked.slice(0, 2)) {
      lines.push(`- ${run.datasetId} (${shortenRunId(run.id)}): worker state needs reconciliation.`);
    }
  }

  if (failed.length > 0) {
    lines.push("", "Failed");
    for (const run of failed.slice(0, 2)) {
      lines.push(`- ${run.datasetId} (${shortenRunId(run.id)}): ${formatStatusForHumans(run.status)}.`);
    }
  }

  if (active.length > 0) {
    const nextRun = active[0]!;
    lines.push("", `Best next step: wait on ${nextRun.datasetId} (${shortenRunId(nextRun.id)}) if you need that work, or ask for its status if you think it is stuck.`);
  } else if (continuityLifecycle(relevant) === "completed") {
    lines.push("", `Best next step: open the ${relevant.datasetId} run artifacts and inspect ${summarizeContinuityArtifacts(relevantResults?.artifacts ?? []).bestArtifact ?? "the saved outputs"}.`);
  } else {
    lines.push("", `Best next step: inspect ${relevant.datasetId} (${shortenRunId(relevant.id)}) and decide whether to retry or resume it.`);
  }

  return lines.join("\n");
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

function compactPlainText(value: string, maxLength = 220) {
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function previewMarkdownText(value: string, maxLength = 260) {
  const cleaned = value
    .split("\n")
    .map((line) => line.replace(/^[#>*`\-\d.\s]+/u, "").trim())
    .filter(Boolean)
    .join(" ");
  return cleaned ? compactPlainText(cleaned, maxLength) : null;
}

function formatResultValue(value: unknown) {
  if (typeof value === "number") {
    return Number.isInteger(value) ? formatNumber(value) : String(value);
  }
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return null;
}

function formatTableCoverage(table: Record<string, unknown>) {
  const timeStart = formatResultValue(table.timeStart);
  const timeEnd = formatResultValue(table.timeEnd);
  const frequency = formatResultValue(table.frequency);
  const parts = [timeStart && timeEnd ? `${timeStart} to ${timeEnd}` : timeStart ?? timeEnd, frequency].filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join(" · ") : null;
}

function renderStructuredResult(result: Record<string, unknown>) {
  const lines: string[] = [];
  const summary = isRecord(result.summary) ? result.summary : null;
  const summaryDescription = typeof summary?.description === "string" ? compactPlainText(summary.description, 220) : null;
  const summaryDataset = typeof summary?.dataset === "string" ? summary.dataset : null;
  const summaryStage = typeof summary?.stage === "string" ? summary.stage : null;
  if (summaryDescription) {
    lines.push("Summary", `- ${summaryDescription}`);
    if (summaryDataset || summaryStage) {
      lines.push(`- Scope: ${[summaryDataset, summaryStage].filter(Boolean).join(" · ")}`);
    }
  }
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
  const sources = isRecord(result.sources) ? result.sources : null;
  if (sources) {
    const total = typeof sources.total === "number" ? formatNumber(sources.total) : null;
    const statusCounts = isRecord(sources.statusCounts) ? sources.statusCounts : null;
    const qualityBits: string[] = [];
    if (total) qualityBits.push(`${total} sources`);
    if (typeof statusCounts?.ready === "number") qualityBits.push(`${formatNumber(statusCounts.ready)} ready`);
    if (typeof statusCounts?.partial === "number" && statusCounts.partial > 0) qualityBits.push(`${formatNumber(statusCounts.partial)} partial`);
    if (typeof statusCounts?.deferred === "number" && statusCounts.deferred > 0) qualityBits.push(`${formatNumber(statusCounts.deferred)} deferred`);
    if (qualityBits.length > 0) {
      lines.push("", "Coverage", `- ${qualityBits.join(" · ")}`);
    }
  }
  const tables = Array.isArray(result.tables) ? result.tables.filter(isRecord) : [];
  if (tables.length > 0) {
    lines.push("", "Key tables");
    for (const table of tables.slice(0, 3)) {
      const path = typeof table.path === "string" ? table.path : "table";
      const rowCountValue = typeof table.rowCount === "number" ? `${formatNumber(table.rowCount)} rows` : null;
      const coverage = formatTableCoverage(table);
      const geoCount = typeof table.geoCount === "number" ? `${formatNumber(table.geoCount)} geographies` : null;
      const details = [rowCountValue, coverage, geoCount].filter((value): value is string => Boolean(value));
      lines.push(`- ${path}${details.length > 0 ? `: ${details.join(" · ")}` : ""}`);
    }
  }
  const quality = isRecord(result.quality) ? result.quality : null;
  const qcMetrics = isRecord(quality?.qcMetrics) ? quality.qcMetrics : null;
  const qualityNotes: string[] = [];
  if (typeof qcMetrics?.total_counties === "number") qualityNotes.push(`${formatNumber(qcMetrics.total_counties)} counties`);
  if (typeof qcMetrics?.total_months === "number") qualityNotes.push(`${formatNumber(qcMetrics.total_months)} months`);
  if (typeof qcMetrics?.missing_income_share === "number") qualityNotes.push(`${Math.round(qcMetrics.missing_income_share * 100)}% missing income coverage`);
  if (typeof qcMetrics?.missing_mortgage_share === "number") qualityNotes.push(`${Math.round(qcMetrics.missing_mortgage_share * 100)}% missing mortgage coverage`);
  if (qualityNotes.length > 0) {
    lines.push("", "Quality", `- ${qualityNotes.join(" · ")}`);
  }
  const limitations = isRecord(result.limitations) ? result.limitations : null;
  const deferredSources = Array.isArray(limitations?.deferredSources) ? limitations.deferredSources.filter(isRecord) : [];
  const partialSources = Array.isArray(limitations?.partialSources) ? limitations.partialSources.filter(isRecord) : [];
  if (deferredSources.length > 0 || partialSources.length > 0) {
    lines.push("", "Limitations");
    if (deferredSources.length > 0) {
      lines.push(`- Deferred sources: ${deferredSources.slice(0, 2).map((entry) => String(entry.id ?? "unknown")).join(", ")}`);
    }
    if (partialSources.length > 0) {
      lines.push(`- Partial sources: ${partialSources.slice(0, 2).map((entry) => String(entry.id ?? "unknown")).join(", ")}`);
    }
  }
  if (lines.length === 0) {
    lines.push("Summary", "- Structured result is available in `result.json`.");
  }
  return lines.join("\n");
}

function renderArtifactPreview(artifacts: Array<{ title?: string; type?: string; content?: unknown }>) {
  const summaryArtifact = artifacts.find((artifact) => artifact.type === "remote_agent_summary" && typeof artifact.content === "string");
  if (summaryArtifact && typeof summaryArtifact.content === "string" && summaryArtifact.content.trim()) {
    return summaryArtifact.content.trim();
  }
  const markdownArtifact = artifacts.find((artifact) => typeof artifact.content === "string" && artifact.title?.endsWith(".md"));
  if (markdownArtifact && typeof markdownArtifact.content === "string" && markdownArtifact.content.trim()) {
    return markdownArtifact.content.trim();
  }
  return null;
}

function formatAbsoluteTimestamp(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function formatRelativeTimestamp(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  if (Math.abs(diffMinutes) < 1) return "just now";
  if (Math.abs(diffMinutes) < 60) return `${Math.abs(diffMinutes)} minute${Math.abs(diffMinutes) === 1 ? "" : "s"} ${diffMinutes < 0 ? "ago" : "from now"}`;
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return `${Math.abs(diffHours)} hour${Math.abs(diffHours) === 1 ? "" : "s"} ${diffHours < 0 ? "ago" : "from now"}`;
  const diffDays = Math.round(diffHours / 24);
  return `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"} ${diffDays < 0 ? "ago" : "from now"}`;
}

function formatWhen(value: string | undefined) {
  const absolute = formatAbsoluteTimestamp(value);
  const relative = formatRelativeTimestamp(value);
  if (absolute && relative) return `${absolute} (${relative})`;
  return absolute ?? relative ?? "unknown";
}

function chooseLastRunForResults(runs: TrackedRunRecord[]) {
  const latestTracked = runs[0] ?? null;
  const latestCompleted = runs.find((run) => isTerminalRunSuccessStatus(run.status)) ?? null;
  const latestFailed = runs.find((run) => isTerminalRunFailureStatus(run.status) || isUncertainRunStatus(run.status)) ?? null;
  const activeRuns = runs.filter((run) => !run.terminalAt && !isTerminalRunStatus(run.status));
  return { latestTracked, latestCompleted, latestFailed, activeRuns };
}

async function maybeHandleLastRunResultsRequest(
  input: string,
  initialSession: SessionRecord | null,
  deps: AgentRuntimeDeps,
  emit: (message: AgentMessage) => void,
) {
  const lower = input.toLowerCase();
  if (!initialSession || !/\blast\b/.test(lower) || !/\b(run|result|results|artifacts?)\b/.test(lower) || /\b(stuck|happening|progress|status)\b/.test(lower)) {
    return null;
  }

  emit({ role: "tool", content: "Checking run history..." });
  const runs = await readTrackedRuns().catch(() => []);
  if (runs.length === 0) {
    return "I do not see any tracked runs yet.";
  }

  const { latestTracked, latestCompleted, latestFailed, activeRuns } = chooseLastRunForResults(runs);
  if (!latestCompleted) {
    if (latestTracked && !isTerminalRunStatus(latestTracked.status)) {
      const lines = [
        "Your latest tracked run is still in progress, so there are no finished results to show yet.",
        "",
        `Selected run: ${latestTracked.datasetId}`,
        `Status: ${formatStatusForHumans(latestTracked.status)}`,
        `Last update: ${formatWhen(latestTracked.updatedAt)}`,
      ];
      if (latestTracked.prompt) lines.push(`What it is doing: ${compactPromptLine(latestTracked.prompt)}`);
      lines.push("", "No saved result or artifact is available from that run yet.");
      return lines.join("\n");
    }
    if (latestFailed) {
      return [
        "Your latest tracked run did not complete successfully, so there are no clean results to show.",
        "",
        `Selected run: ${latestFailed.datasetId}`,
        `Status: ${formatStatusForHumans(latestFailed.status)}`,
        `Last update: ${formatWhen(latestFailed.updatedAt)}`,
        "",
        "That run needs inspection or a retry before it can produce a usable result.",
      ].join("\n");
    }
    return "I found tracked runs, but none has completed successfully yet.";
  }

  const reason = latestTracked?.id === latestCompleted.id
    ? "Selected your most recent tracked run because it already completed."
    : "Selected your most recent completed run because newer tracked runs are still in progress.";

  emit({ role: "tool", content: `Retrieving results for ${latestCompleted.datasetId}...` });
  const payload = await deps.createRemoteClient(initialSession).getRunResults(latestCompleted.id);
  const producedArtifacts = payload.artifacts.filter(isProducedArtifact);
  const structuredResult = findStructuredResultArtifact(producedArtifacts);
  const preview = renderArtifactPreview(producedArtifacts);
  const previewText = preview ? previewMarkdownText(preview) : null;
  const skippedActive = activeRuns.filter((run) => run.id !== latestCompleted.id).slice(0, 2);
  const lines = [
    "Retrieved the latest finished results from your run history.",
    "",
    `Selected run: ${payload.run.datasetId}`,
    `Completed: ${formatWhen(latestCompleted.terminalAt ?? latestCompleted.updatedAt)}`,
    `Why this run: ${reason.replace(/\.$/u, "")}.`,
  ];
  if (skippedActive.length > 0) {
    lines.push(`Skipped newer in-progress run${skippedActive.length === 1 ? "" : "s"}: ${skippedActive.map((run) => `${run.datasetId} (${formatStatusForHumans(run.status)})`).join(", ")}.`);
  }
  if (previewText) {
    lines.push("", "Summary", `- ${previewText}`);
  }
  if (structuredResult?.content && isRecord(structuredResult.content)) {
    lines.push("", renderStructuredResult(structuredResult.content));
  } else if (!previewText && preview) {
    lines.push("", "Summary", `- ${compactPlainText(preview, 240)}`);
  }
  if (producedArtifacts.length > 0) {
    lines.push("", "Artifacts", ...producedArtifacts.slice(0, 4).map((artifact) => `- ${artifactBullet(artifact)}`));
  }
  lines.push("", "Retrieved successfully.");
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

function compactPromptLine(prompt: string | undefined, maxLength = 160) {
  const normalized = (prompt ?? "").replace(/\s+/gu, " ").trim();
  if (!normalized) return null;
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized;
}

function inferExpectedArtifacts(
  artifacts: Array<Record<string, unknown>> | undefined,
  prompt: string | undefined,
) {
  const labels = new Set<string>();
  for (const artifact of artifacts ?? []) {
    const title = typeof artifact.title === "string" ? artifact.title.trim() : "";
    const type = typeof artifact.type === "string" ? artifact.type.trim() : "";
    if (title) {
      labels.add(title);
      continue;
    }
    if (type === "markdown") {
      labels.add("Validation report");
      continue;
    }
    if (type) {
      labels.add(type.replace(/_/gu, " "));
    }
  }
  const promptLower = (prompt ?? "").toLowerCase();
  if (promptLower.includes("data dictionary")) labels.add("Data dictionary");
  if (promptLower.includes("manifest")) labels.add("Manifest");
  if (promptLower.includes("validation")) labels.add("Validation report");
  return Array.from(labels);
}

function inferValidationChecks(prompt: string | undefined) {
  const lower = (prompt ?? "").toLowerCase();
  const checks: string[] = [];
  if (lower.includes("source url")) checks.push("source URLs");
  if (lower.includes("row count")) checks.push("row counts");
  if (lower.includes("missingness")) checks.push("missingness");
  if (lower.includes("join key")) checks.push("join keys");
  if (lower.includes("temporal coverage")) checks.push("temporal coverage");
  return checks;
}

function formatEnvironmentBuildSummary(args: {
  buildKind: "research environment" | "public-data environment";
  datasetId: string;
  datasetName?: string;
  prompt?: string;
  artifacts?: Array<Record<string, unknown>>;
  run: { id: string; status: string };
  origin: string;
}) {
  const lines = [
    `Started ${args.buildKind} build for ${args.datasetName?.trim() || args.datasetId}.`,
    `Dataset: ${args.datasetId}`,
    `Run: ${args.run.id} (${normalizeAsyncRunStatus(args.run.status)})`,
  ];
  const plan = compactPromptLine(args.prompt);
  if (plan) {
    lines.push(`Plan: ${plan}`);
  }
  const validationChecks = inferValidationChecks(args.prompt);
  if (validationChecks.length > 0) {
    lines.push(`Validation preserved: ${validationChecks.join(", ")}.`);
  }
  const expectedArtifacts = inferExpectedArtifacts(args.artifacts, args.prompt);
  if (expectedArtifacts.length > 0) {
    lines.push(`Expected artifacts: ${expectedArtifacts.join("; ")}`);
  }
  lines.push(
    `Status: ${formatStatusForHumans(args.run.status)}. The build launched and will keep running in the background.`,
    `Next: check \`research debug run ${args.run.id}\` or ask \`research show active runs\`.`,
    `Monitor: research debug run ${args.run.id}`,
    `Dashboard: ${dashboardRunUrl(args.origin, args.run.id)}`,
  );
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

type ResolvedDatasetTarget = {
  requestedDatasetId: string;
  datasetId: string;
  datasetName?: string;
  reusedExisting: boolean;
};

function summarizeResolvedDataset(target: ResolvedDatasetTarget, purpose: string) {
  const label = target.datasetName ? `${target.datasetName} (${target.datasetId})` : target.datasetId;
  if (target.reusedExisting && target.datasetId !== target.requestedDatasetId) {
    return `Using existing dataset ${label} for ${purpose} instead of unavailable duplicate ${target.requestedDatasetId}.`;
  }
  return `Using dataset ${label} for ${purpose}.`;
}

function explainEnvironmentSelection(target: ResolvedDatasetTarget) {
  const label = target.datasetName ? `${target.datasetName} (${target.datasetId})` : target.datasetId;
  if (target.reusedExisting && target.datasetId !== target.requestedDatasetId) {
    return `Best existing base: ${label}. Reusing it so this build extends a ready environment instead of creating a duplicate dataset first.`;
  }
  return `Build target: ${label}. No stronger existing environment was selected for reuse.`;
}

function parseBusyDatasetConflict(error: RemoteRequestError) {
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
    return {
      message: payload.error,
      runId: "unknown",
      status: "running",
      datasetId: null,
      prompt: null,
      createdAt: undefined,
      updatedAt: undefined,
    };
  }
  return {
    message: payload.error,
    runId: typeof first.id === "string" ? first.id : "unknown",
    status: typeof first.status === "string" ? first.status : "running",
    datasetId: typeof first.datasetId === "string" ? first.datasetId : null,
    prompt: typeof first.prompt === "string" && first.prompt.trim() ? first.prompt.trim() : null,
    createdAt: typeof first.createdAt === "string" ? first.createdAt : undefined,
    updatedAt: typeof first.updatedAt === "string" ? first.updatedAt : typeof first.createdAt === "string" ? first.createdAt : undefined,
  };
}

function summarizeBusyDatasetConflict(
  error: RemoteRequestError,
  options?: {
    target?: ResolvedDatasetTarget;
    purpose?: string;
    expectedArtifacts?: string[];
  },
) {
  const conflict = parseBusyDatasetConflict(error);
  if (!conflict) {
    return null;
  }
  const purpose = options?.purpose ?? "this request";
  const lockSummary = renderBusyDatasetConflict({
    datasetId: conflict.datasetId ?? options?.target?.datasetId,
    runId: conflict.runId,
    status: conflict.status,
    createdAt: conflict.createdAt,
    updatedAt: conflict.updatedAt,
    dashboardUrl: dashboardRunUrl(DEFAULT_WEB_ORIGIN, conflict.runId),
  });
  const lines = [
    `Blocked: ${purpose} is waiting on an active dataset run.`,
    `An analysis is already running${conflict.datasetId ? ` on ${conflict.datasetId}` : " on this dataset"}.`,
    options?.target ? summarizeResolvedDataset(options.target, purpose) : null,
    `Active run: ${conflict.runId}`,
    `State: ${conflict.status}`,
    conflict.prompt ? `Current work: ${conflict.prompt.slice(0, 140)}` : null,
    "",
    "I did not start a duplicate run because that active run still holds the dataset volume.",
    options?.expectedArtifacts?.length
      ? `Expected artifacts once the run finishes: ${options.expectedArtifacts.join(", ")}.`
      : null,
    `When it finishes, ask: show results from ${conflict.runId}`,
    `Inspect in CLI: research debug run ${conflict.runId}`,
    "",
    lockSummary,
  ];
  return lines.filter(Boolean).join("\n");
}

function schemaFieldNames(schema: unknown) {
  if (!Array.isArray(schema)) return [];
  return schema
    .map((field) => (isRecord(field) && typeof field.name === "string" ? field.name.trim() : ""))
    .filter((name) => name.length > 0);
}

function findMatchingFields(fieldNames: string[], patterns: RegExp[]) {
  const matches: string[] = [];
  for (const fieldName of fieldNames) {
    if (patterns.some((pattern) => pattern.test(fieldName))) {
      matches.push(fieldName);
    }
  }
  return matches;
}

function toolHeartbeatIntervalMs() {
  return Number(process.env.RESEARCH_TOOL_HEARTBEAT_INTERVAL_MS ?? "4000");
}

function joinWithAnd(values: string[]) {
  if (values.length <= 1) return values.join("");
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function summarizeRemoteDatasetInspection(dataset: RemoteDatasetDetail) {
  const profile = dataset.profile;
  const fieldNames = schemaFieldNames(profile?.schema);
  const countyFields = findMatchingFields(fieldNames, [/county/i, /\bfips\b/i]);
  const yearFields = findMatchingFields(fieldNames, [/\byear\b/i, /date/i, /month/i, /quarter/i]);
  const unemploymentFields = findMatchingFields(fieldNames, [/unemployment/i, /jobless/i, /labor/i]);
  const homeValueFields = findMatchingFields(fieldNames, [/home[_ ]?value/i, /house[_ ]?price/i, /hpi\b/i, /zillow/i]);
  const timeCoverage = isRecord(profile?.timeCoverage) ? profile?.timeCoverage : null;
  const geographyCoverage = isRecord(profile?.geographyCoverage) ? profile?.geographyCoverage : null;
  const start = typeof timeCoverage?.start === "string" ? timeCoverage.start : typeof timeCoverage?.min === "string" ? timeCoverage.min : null;
  const end = typeof timeCoverage?.end === "string" ? timeCoverage.end : typeof timeCoverage?.max === "string" ? timeCoverage.max : null;
  const geographyLevel = typeof geographyCoverage?.level === "string" ? geographyCoverage.level : null;
  if (countyFields.length === 0 && typeof geographyLevel === "string" && /\bcounty\b/i.test(geographyLevel)) {
    countyFields.push(geographyLevel);
  }
  const matchedCoverage = [
    countyFields.length > 0 ? "county" : null,
    yearFields.length > 0 ? "time" : null,
    unemploymentFields.length > 0 ? "unemployment" : null,
    homeValueFields.length > 0 ? "home value" : null,
  ].filter((value): value is string => value !== null);
  const evidenceFields = [
    countyFields[0],
    yearFields[0],
    unemploymentFields[0],
    homeValueFields[0],
  ].filter((value): value is string => Boolean(value));
  const lines = [`Inspected remote dataset ${dataset.id}.`];
  if (matchedCoverage.length > 0 || evidenceFields.length > 0) {
    const summary = matchedCoverage.length > 0
      ? `${dataset.id} appears to include ${joinWithAnd(matchedCoverage)} fields`
      : `${dataset.id} schema is available`;
    lines.push(`${summary}${evidenceFields.length > 0 ? ` (${evidenceFields.join(", ")})` : ""}.`);
  }
  if (start || end || geographyLevel) {
    lines.push(`Coverage: ${start ?? "unknown start"} to ${end ?? "unknown end"}${geographyLevel ? ` at ${geographyLevel} level` : ""}.`);
  }
  if (typeof profile?.notes === "string" && profile.notes.trim()) {
    lines.push(`Notes: ${profile.notes.trim()}`);
  }
  return lines.join("\n");
}

function summarizeExpectedArtifacts(input: Record<string, unknown>) {
  const artifacts = Array.isArray(input.artifacts) ? input.artifacts : [];
  const titles = artifacts
    .map((artifact) => {
      if (!isRecord(artifact)) return null;
      if (typeof artifact.title === "string" && artifact.title.trim()) return artifact.title.trim();
      if (typeof artifact.type === "string" && artifact.type.trim()) return artifact.type.trim();
      return null;
    })
    .filter((title): title is string => title !== null);
  if (titles.length === 0) return null;
  return `Expected artifacts: ${titles.slice(0, 4).join("; ")}.`;
}

function progressHeartbeat(toolName: string, input: Record<string, unknown>, elapsedSeconds: number) {
  const datasetId = typeof input.datasetId === "string" && input.datasetId.trim() ? input.datasetId.trim() : "the dataset";
  const inputPath = typeof input.inputPath === "string" && input.inputPath.trim() ? basename(input.inputPath.trim()) : "the file";
  if (toolName === "inspect_remote_dataset") {
    return `Still inspecting ${datasetId} for schema, time coverage, and geography fields (${elapsedSeconds}s elapsed).`;
  }
  if (toolName === "request_dataset_source_upload") {
    return `Still preparing the upload for ${datasetId}. Deployment will start after the file is uploaded (${elapsedSeconds}s elapsed).`;
  }
  if (toolName === "upload_local_file") {
    return `Still uploading ${inputPath}. Deployment will start automatically after the upload finishes (${elapsedSeconds}s elapsed).`;
  }
  if (toolName === "complete_dataset_source_upload") {
    return `Still verifying the uploaded source for ${datasetId} so deployment can start (${elapsedSeconds}s elapsed).`;
  }
  if (toolName === "create_research_environment" || toolName === "create_public_data_environment") {
    return `Still preparing the ${datasetId} environment and checking whether the dataset volume is free (${elapsedSeconds}s elapsed).`;
  }
  if (ASYNC_RUN_START_TOOLS.has(toolName)) {
    return `Run startup: waiting for backend worker on ${datasetId} (${elapsedSeconds}s elapsed).`;
  }
  return `Still running ${toolName} (${elapsedSeconds}s elapsed).`;
}

function formatUnknownValue(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const parts: string[] = value
      .map((entry): string | null => formatUnknownValue(entry))
      .filter((entry): entry is string => Boolean(entry));
    return parts.length > 0 ? parts.join("; ") : null;
  }
  if (isRecord(value)) {
    const pairs: string[] = Object.entries(value)
      .map(([key, entry]) => {
        const formatted: string | null = formatUnknownValue(entry);
        return formatted ? `${key}: ${formatted}` : null;
      })
      .filter((entry): entry is string => Boolean(entry));
    return pairs.length > 0 ? pairs.join("; ") : null;
  }
  return null;
}

function formatDatasetProfileFallback(dataset: RemoteDatasetDetail, blockingRun?: { runId: string; status: string }) {
  const profile = dataset.profile;
  if (!profile) {
    return null;
  }
  const lines: string[] = [];
  if (blockingRun) {
    lines.push(
      `Using the latest saved dataset briefing for ${dataset.id} while run ${blockingRun.runId} is ${blockingRun.status}.`,
      "",
    );
  }
  if (typeof profile.briefingMarkdown === "string" && profile.briefingMarkdown.trim().length > 0) {
    lines.push(profile.briefingMarkdown.trim());
  } else {
    lines.push(
      `Dataset Briefing: ${dataset.name || dataset.id}`,
      "",
      `Overview: ${dataset.name || dataset.id}${dataset.status ? ` (${dataset.status})` : ""}`,
    );
    const trust = formatUnknownValue(profile.quality) ?? profile.notes ?? "Saved dataset profile exists, but explicit trust notes are limited.";
    lines.push(`Readiness & Trust: ${trust}`);
    const inventory = formatUnknownValue(profile.tables) ?? formatUnknownValue(profile.schema);
    if (inventory) lines.push(`Data Inventory: ${inventory}`);
    const sources = formatUnknownValue(profile.sources);
    if (sources) lines.push(`Sources: ${sources}`);
    const schema = formatUnknownValue(profile.schema);
    if (schema) lines.push(`Schemas: ${schema}`);
    const timeCoverage = formatUnknownValue(profile.timeCoverage);
    if (timeCoverage) lines.push(`Time Coverage: ${timeCoverage}`);
    const geographyCoverage = formatUnknownValue(profile.geographyCoverage);
    if (geographyCoverage) lines.push(`Geography Coverage: ${geographyCoverage}`);
    const formats = formatUnknownValue(profile.formats);
    if (formats) lines.push(`Formats: ${formats}`);
    const transformations = formatUnknownValue(profile.transformations);
    if (transformations) lines.push(`Transformations & Derived Fields: ${transformations}`);
    const quality = formatUnknownValue(profile.quality);
    if (quality) lines.push(`Quality & Validation: ${quality}`);
    const limitations = formatUnknownValue(profile.limitations);
    if (limitations) lines.push(`Limitations & Known Gaps: ${limitations}`);
  }
  const artifactNotes = [
    profile.briefingArtifactId ? "Dataset Briefing" : null,
    profile.profileArtifactId ? "Dataset Profile" : null,
  ].filter((entry): entry is string => Boolean(entry));
  const generatedAt = profile.describedAt ?? profile.updatedAt;
  if (artifactNotes.length > 0 || generatedAt) {
    lines.push(
      "",
      `Artifacts: ${artifactNotes.length > 0 ? artifactNotes.join(" and ") : "saved dataset profile"}${generatedAt ? ` · updated ${generatedAt}` : ""}`,
    );
  }
  return lines.join("\n");
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

function maybeHandleSignedOutRemoteDatasetRequest(input: string) {
  const lower = input.toLowerCase();
  if (!/\bremote datasets?\b/.test(lower) && !/\bmy datasets?\b/.test(lower) && !/\bshow datasets?\b/.test(lower)) {
    return null;
  }
  return [
    "Sign in to view your remote datasets.",
    "",
    "Next step: run `/login` in this chat or `research login` in another terminal.",
    `After you sign in, ask me again and I’ll pick up: "${input.trim()}".`,
  ].join("\n");
}

function isOrientationPrompt(input: string) {
  const lower = input.trim().toLowerCase();
  if (/^(what can you help me do\??|help|what do you do\??)$/u.test(lower)) {
    return true;
  }
  if (/\b(just opened|what is this|what should i type first|where should i start|how do i start)\b/u.test(lower)) {
    return true;
  }
  return /\bhow\b.*\b(start|begin)\b/u.test(lower) && /\bresearch\b/u.test(lower);
}

function maybeHandleOrientation(input: string) {
  if (!isOrientationPrompt(input)) {
    return null;
  }
  return [
    "RESEARCH is a dataset-backed research agent.",
    "",
    "A dataset is the prepared data you can inspect, question, and run research on here.",
    "",
    "Type this first: `Show my datasets`",
    "",
    "`research login` only matters when you want me to open your account datasets or start cloud-backed research for you.",
    "",
    "Then try one of these:",
    "- `Brief the econ dataset so I understand what is inside`",
    "- `Create a dataset from /full/path/to/file.csv`",
    "- `Plan an analysis for whether retention changed after launch`",
    "- `Show the latest results from earlier work`",
  ].join("\n");
}

export function getLocalDirectResponse(input: string) {
  return maybeHandleOrientation(input)
    ?? maybeHandleCsvImportHowTo(input)
    ?? maybeHandleVagueMarketQuestion(input);
}

function shouldHandleDatasetInventoryLegacy(input: string) {
  const lower = input.trim().toLowerCase();
  if (!/\bdatasets?\b/.test(lower)) {
    return false;
  }
  if (/\b(create|build|make|start|run|analy[sz]e|test|wait|show me results|artifacts?)\b/.test(lower)) {
    return false;
  }
  return /\b(what|which|show|list)\b/.test(lower) || /\bdo i have\b/.test(lower) || /\binventory\b/.test(lower);
}

function wantsLocalDatasetsOnly(input: string) {
  const lower = input.toLowerCase();
  return /\blocal datasets?\b/.test(lower) && !/\bremote datasets?\b/.test(lower);
}

function wantsRemoteDatasetsOnly(input: string) {
  const lower = input.toLowerCase();
  return /\bremote datasets?\b/.test(lower) && !/\blocal datasets?\b/.test(lower);
}

function wantsAllDatasets(input: string) {
  const lower = input.toLowerCase();
  return /\b(all datasets|include tests|including tests|show hidden|debug datasets?)\b/.test(lower);
}

function looksLikeNoisyDataset(id: string, name: string) {
  const text = `${id} ${name}`.toLowerCase();
  if (/mixed-smoke|smoke test|fixture|sample fixture/.test(text)) return true;
  if (/^upload-test[-\d]*$/u.test(id.toLowerCase()) || /^upload test\b/u.test(name.toLowerCase())) return true;
  return false;
}

function normalizeRemoteDatasetState(dataset: RemoteDatasetSummary): DatasetInventoryEntry["state"] {
  const status = (dataset.status ?? "").toLowerCase();
  const deploymentStatus = (dataset.deploymentStatus ?? "").toLowerCase();
  if (deploymentStatus === "deployed" || deploymentStatus === "ready" || status === "ready" || status === "deployed") {
    return "ready";
  }
  if (deploymentStatus === "deploying" || status === "deploying" || status === "uploading" || status === "building") {
    return "building";
  }
  if (deploymentStatus === "deployable" || status === "deployable" || status === "uploaded") {
    return "deployable";
  }
  return "draft";
}

function localInventoryEntry(instance: Awaited<ReturnType<typeof listInstanceBundles>>[number]): DatasetInventoryEntry {
  return {
    id: instance.id,
    name: instance.displayName || instance.productName || instance.id,
    scope: "local",
    state: "ready",
    description: instance.description?.trim() || `${formatNumber(instance.recordCount)} records`,
    hidden: looksLikeNoisyDataset(instance.id, instance.displayName || instance.productName || instance.id),
  };
}

function remoteInventoryEntry(dataset: RemoteDatasetSummary): DatasetInventoryEntry {
  const state = normalizeRemoteDatasetState(dataset);
  return {
    id: dataset.id,
    name: dataset.name?.trim() || dataset.id,
    scope: "remote",
    state,
    description: null,
    hidden: looksLikeNoisyDataset(dataset.id, dataset.name ?? dataset.id),
  };
}

function inventoryStateLabel(state: DatasetInventoryEntry["state"]) {
  switch (state) {
    case "ready":
      return "ready";
    case "building":
      return "building";
    case "deployable":
      return "deployable";
    case "draft":
    default:
      return "draft";
  }
}

function padCell(value: string, width: number) {
  if (value.length >= width) return value;
  return value.padEnd(width, " ");
}

function trimCell(value: string, width: number) {
  if (value.length <= width) return value;
  if (width <= 3) return value.slice(0, width);
  return `${value.slice(0, width - 3)}...`;
}

function renderInventoryTable(entries: DatasetInventoryEntry[]) {
  const headers = ["name", "id", "scope", "state", "description"] as const;
  const rows = entries.map((entry) => [
    entry.name,
    entry.id,
    entry.scope,
    inventoryStateLabel(entry.state),
    entry.description ?? "—",
  ]);
  const widths = headers.map((header, index) => {
    const cellWidths = rows.map((row) => row[index]?.length ?? 0);
    return Math.min(Math.max(header.length, ...cellWidths), index === 4 ? 44 : 28);
  });
  const renderRow = (cells: string[]) => cells.map((cell, index) => padCell(trimCell(cell, widths[index] ?? cell.length), widths[index] ?? cell.length)).join("  ");
  return [
    renderRow([...headers]),
    renderRow(widths.map((width) => "-".repeat(width))),
    ...rows.map(renderRow),
  ].join("\n");
}

function nextDatasetStep(entries: DatasetInventoryEntry[]) {
  const preferred = entries.find((entry) => entry.state === "ready" && entry.scope === "remote")
    ?? entries.find((entry) => entry.state === "ready");
  if (!preferred) {
    return "Choose a ready or deployable dataset to inspect next.";
  }
  return preferred.scope === "remote"
    ? `Try \`describe ${preferred.id}\` to inspect what is inside ${preferred.name}.`
    : `Try \`describe ${preferred.id}\` or ask what is inside ${preferred.name}.`;
}

async function maybeHandleDatasetInventoryLegacy(
  input: string,
  initialSession: SessionRecord | null,
  emit: (message: AgentMessage) => void,
  deps: AgentRuntimeDeps,
) {
  if (!shouldHandleDatasetInventoryLegacy(input)) {
    return null;
  }

  const localOnly = wantsLocalDatasetsOnly(input);
  const remoteOnly = wantsRemoteDatasetsOnly(input);
  const includeHidden = wantsAllDatasets(input);

  const entries: DatasetInventoryEntry[] = [];
  let hiddenCount = 0;

  if (!remoteOnly) {
    emit({ role: "tool", content: "Checking local datasets..." });
    const instances = await listInstanceBundles(DEFAULT_INSTANCE_ROOT);
    const localEntries = instances.map(localInventoryEntry);
    hiddenCount += localEntries.filter((entry) => entry.hidden).length;
    entries.push(...(includeHidden ? localEntries : localEntries.filter((entry) => !entry.hidden)));
    emit({ role: "tool", content: instances.length > 0 ? `Found ${instances.length} local datasets.` : "No local datasets found." });
  }

  if (!localOnly && initialSession) {
    emit({ role: "tool", content: "Checking remote datasets. This can take a few seconds..." });
    const client = deps.createRemoteClient(initialSession);
    const datasets = await client.listDatasets();
    const remoteEntries = datasets.datasets.map(remoteInventoryEntry);
    hiddenCount += remoteEntries.filter((entry) => entry.hidden).length;
    entries.push(...(includeHidden ? remoteEntries : remoteEntries.filter((entry) => !entry.hidden)));
    emit({ role: "tool", content: datasets.datasets.length > 0 ? `Found ${datasets.datasets.length} remote datasets.` : "No remote datasets found." });
  }

  if (!localOnly && !initialSession && remoteOnly) {
    return "Sign in first with `/login`, then ask me to show remote datasets.";
  }

  const sorted = entries.sort((left, right) =>
    Number(right.state === "ready") - Number(left.state === "ready")
    || Number(left.scope === "local") - Number(right.scope === "local")
    || left.name.localeCompare(right.name));

  if (sorted.length === 0) {
    return localOnly
      ? "I do not see any local datasets yet."
      : remoteOnly
        ? "I do not see any remote datasets yet."
        : "I do not see any datasets yet.";
  }

  const lines = [
    "Available datasets",
    "",
    renderInventoryTable(sorted),
  ];
  if (hiddenCount > 0 && !includeHidden) {
    lines.push("", `Hidden ${hiddenCount} likely test or system datasets. Ask \`show all datasets\` to include them.`);
  }
  lines.push("", `Next: ${nextDatasetStep(sorted)}`);
  return lines.join("\n");
}

function maybeHandleCsvImportHowTo(input: string) {
  const lower = input.toLowerCase();
  const mentionsTabularFile = /\b(csv|tsv|parquet|jsonl?|spreadsheet|export|file)\b/.test(lower);
  const mentionsImportIntent = /\b(how|need from me|turn it|turn this|import|ingest|create|build|research here|dataset)\b/.test(lower);
  const missingAbsolutePath = !/(^|[\s("'`])\/[^\s"'`)]+|[a-z]:\\[^\s]+/i.test(input);
  if (!mentionsTabularFile || !mentionsImportIntent || !missingAbsolutePath) {
    return null;
  }
  return [
    "I can help with that, but I need 2 things first:",
    "",
    "- Absolute file path",
    "- One-line description of what is in the file",
    "",
    "Send path + one-line description:",
    "",
    "`/absolute/path/to/local-file.csv` + `CSV of customer support tickets`",
    "",
    "Next: I will inspect the file, infer the schema, normalize it, and get it ready for research.",
    "Reply with the absolute path to the local file and a one-line description. No upload is needed.",
    "Tip: drag the file into Terminal to paste the path.",
  ].join("\n");
}

function maybeHandleVagueMarketQuestion(input: string) {
  const lower = input.toLowerCase();
  if (!/\bhousing market\b/.test(lower) || !/\b(trouble|crash|bad|risk|look into)\b/.test(lower)) {
    return null;
  }
  return [
    "Waiting for your answer",
    "",
    "Start with one scope choice: U.S. housing market or a specific metro/region?",
    "",
    "If you want a default, reply: `U.S., quick read.`",
    "After that, I will define the right trouble signals for that scope, usually starting with affordability and inventory before going deeper.",
  ].join("\n");
}

function shouldHandleVagueTweetsExperiment(input: string) {
  const lower = input.toLowerCase();
  if (!/\btweets?\b/.test(lower) || !/\bviral|virality\b/.test(lower) || !/\b(experiment|run|analy[sz]e|look into)\b/.test(lower)) {
    return false;
  }
  if (/\btop\s*0\.1%|quote_tweet_count|sample\s+100|strict json\b/.test(lower)) {
    return false;
  }
  return true;
}

function tweetDatasetLooksUsable(dataset: RemoteDatasetSummary | RemoteDatasetDetail) {
  const metadata = datasetMetadataText(dataset);
  return /\btweet/.test(metadata) && /\bquote_tweet_count\b/.test(metadata);
}

function formatViralTweetsExperimentProposal(dataset: RemoteDatasetSummary | RemoteDatasetDetail, wasVerified: boolean) {
  const label = `\`${dataset.id}\`${dataset.name && dataset.name !== dataset.id ? ` (${dataset.name})` : ""}`;
  const datasetLine = wasVerified
    ? `Confirmed dataset: ${label}.`
    : `Best available dataset: ${label}.`;
  const datasetWhy = wasVerified
    ? "Why this dataset: it is present in RESEARCH and its metadata includes tweet engagement fields needed for a first-pass virality experiment."
    : "Why this dataset: it looks like the closest tweet dataset currently available in RESEARCH for an engagement-based virality experiment.";
  return [
    "Before I start a remote run, here is the experiment I recommend.",
    "",
    "Plan",
    datasetLine,
    datasetWhy,
    "Success looks like: a short report that explains which tweet patterns show up most often in the viral sample, with charts and concrete examples.",
    "",
    "Definition",
    "Default metric: top 0.1% by `quote_tweet_count`.",
    "Why this metric: quote tweets usually capture stronger downstream spread and commentary than likes alone, so it is a useful first viral proxy.",
    "Sample: label 100 tweets from the viral set.",
    "Why 100: it is enough for a first-pass pattern read without paying for a much larger labeling job up front.",
    "Labels: `hook_type`, `emotional_tone`, `controversy_level`.",
    "Outputs: a short summary, one bar chart per label, and 10 representative examples.",
    "",
    "Choose the virality rule",
    "1. Top 0.1% by `quote_tweet_count`.",
    "2. Top 0.1% by `retweet_count`.",
    "3. Top 0.1% by `favorite_count`.",
    "",
    "Waiting for your approval",
    "Reply with 1, 2, or 3 to start with that metric.",
    "Optional override: tell me a different sample size or ask for a control group before I launch anything.",
  ].join("\n");
}

async function maybeHandleVagueTweetsExperiment(
  input: string,
  initialSession: SessionRecord | null,
  emit: (message: AgentMessage) => void,
  deps: AgentRuntimeDeps,
) {
  if (!initialSession || !shouldHandleVagueTweetsExperiment(input)) {
    return null;
  }
  const client = deps.createRemoteClient(initialSession);
  emit({ role: "tool", content: "Checking remote datasets..." });
  const listed = await client.listDatasets().catch(() => null);
  if (!listed) {
    return [
      "Before I start a remote run, I need to confirm which tweets dataset is available in RESEARCH.",
      "",
      "Reply with the dataset you want me to use, or ask me to show tweet datasets first.",
    ].join("\n");
  }
  emit({ role: "tool", content: `Found ${listed.datasets.length} remote datasets.` });
  const selected = chooseDatasetBriefingTarget("enriched-tweets", listed.datasets)
    ?? listed.datasets.find((dataset) => tweetDatasetLooksUsable(dataset))
    ?? listed.datasets.find((dataset) => /\btweet/.test(datasetMetadataText(dataset)))
    ?? null;
  if (!selected) {
    return [
      "I did not find a usable tweets dataset in RESEARCH, so I should not launch this experiment yet.",
      "",
      "Next: ask me to show datasets or help build a tweets dataset with text, timestamps, authors, and engagement fields.",
    ].join("\n");
  }
  emit({ role: "tool", content: `Inspecting dataset ${selected.id}...` });
  const detail = await client.getDataset(selected.id).catch(() => null);
  if (detail?.dataset) {
    emit({ role: "tool", content: `Confirmed dataset ${selected.id} for tweet analysis.` });
    return formatViralTweetsExperimentProposal(detail.dataset, true);
  }
  emit({ role: "tool", content: `Using dataset inventory evidence for ${selected.id}.` });
  return formatViralTweetsExperimentProposal(selected, false);
}

function shouldHandleFieldDefinitionQuestion(input: string) {
  const lower = input.trim().toLowerCase();
  return /\bwhat does\b|\bmeaning\b|\bmean\b/.test(lower)
    && /\bfield\b|\bdataset\b|\bschema\b|\bcount\b/.test(lower)
    && /\bvirality\b|\bviral\b|\bproxy\b|\buse it\b/.test(lower);
}

function extractFieldDefinitionTarget(input: string) {
  const datasetReference = extractRequestedDatasetReference(input);
  const fieldMatch = input.match(/\b([a-z][a-z0-9_]*count)\b/i);
  return {
    datasetReference,
    fieldName: fieldMatch?.[1]?.toLowerCase() ?? null,
  };
}

function chooseDatasetForFieldDefinition(reference: string | null, datasets: RemoteDatasetSummary[]) {
  if (reference) {
    return chooseDatasetBriefingTarget(reference, datasets);
  }
  return datasets.find((dataset) => /\btweet/.test(`${dataset.id} ${dataset.name}`.toLowerCase())) ?? null;
}

function schemaFieldRecord(schema: unknown, fieldName: string) {
  if (!Array.isArray(schema)) return null;
  for (const field of schema) {
    if (!isRecord(field) || typeof field.name !== "string") continue;
    if (field.name.trim().toLowerCase() === fieldName) {
      return field;
    }
  }
  return null;
}

function sampleRowHasField(sampleRows: unknown, fieldName: string) {
  if (!Array.isArray(sampleRows)) return false;
  return sampleRows.some((row) => isRecord(row) && Object.prototype.hasOwnProperty.call(row, fieldName));
}

function inferQuoteTweetCountDefinition(fieldName: string) {
  if (fieldName === "quote_tweet_count") {
    return "the number of distinct tweets that quote a given tweet";
  }
  return `${fieldName} appears to be a count field, but the exact meaning was not confirmed from metadata`;
}

function renderFieldDefinitionAnswer(dataset: RemoteDatasetDetail, fieldName: string) {
  const schemaField = schemaFieldRecord(dataset.profile?.schema, fieldName);
  const hasSampleValue = sampleRowHasField(dataset.profile?.sampleRows, fieldName);
  const confirmed = Boolean(schemaField) || hasSampleValue;
  const typeLabel = schemaField && typeof schemaField.type === "string" ? schemaField.type.trim() : null;
  const quoteEvidence = schemaFieldRecord(dataset.profile?.schema, "quoted_tweet_id");
  const meaning = inferQuoteTweetCountDefinition(fieldName);
  const evidenceLines = confirmed
    ? [
      `Confirmed in \`${dataset.id}\`${typeLabel ? ` as a ${typeLabel} field` : ""}${hasSampleValue ? " and present in sample rows" : ""}.`,
      !schemaField && hasSampleValue ? `I verified it from sample row keys even though the typed schema entry is missing.` : null,
    ].filter(Boolean) as string[]
    : [
      `I did not verify \`${fieldName}\` in \`${dataset.id}\` metadata.`,
      "The definition below is based on a common tweets schema pattern, so treat it as an inference.",
    ];
  const derivationLine = !confirmed && quoteEvidence
    ? "If the stored count is missing, derive it as `quote_count_for_tweet = count(rows where row.quoted_tweet_id == target.tweet_id)`."
    : null;

  return [
    "`quote_tweet_count` is a useful virality signal, but not a definition of virality on its own.",
    "",
    `Meaning: in this dataset context it means ${meaning}.`,
    `Schema check: ${evidenceLines.join(" ")}`,
    "Recommendation: use it as one feature in a multi-signal virality score, not the sole definition.",
    "Limitation: quote volume captures discourse and controversy more than broad reach, so it can over-rank polarizing tweets.",
    derivationLine,
    "Next step: compare quote_tweet_count against retweet_count over the same posting window before operationalizing a virality rule.",
  ].filter(Boolean).join("\n");
}

async function maybeHandleFieldDefinitionQuestion(
  input: string,
  initialSession: SessionRecord | null,
  emit: (message: AgentMessage) => void,
  deps: AgentRuntimeDeps,
) {
  if (!initialSession || !shouldHandleFieldDefinitionQuestion(input)) {
    return null;
  }

  const { datasetReference, fieldName } = extractFieldDefinitionTarget(input);
  if (!fieldName) {
    return null;
  }

  const client = deps.createRemoteClient(initialSession);
  if (typeof client.listDatasets !== "function" || typeof client.getDataset !== "function") {
    return null;
  }
  emit({ role: "tool", content: "Checking remote datasets..." });
  const listed = await client.listDatasets().catch(() => null);
  if (!listed?.datasets?.length) {
    return null;
  }

  const selected = chooseDatasetForFieldDefinition(datasetReference, listed.datasets);
  if (!selected) {
    return [
      `I could not find a tweets dataset matching \`${datasetReference ?? "tweets"}\`.`,
      "Ask `show my datasets` if you want me to inspect the available dataset ids first.",
    ].join("\n");
  }

  emit({ role: "tool", content: `Inspecting dataset ${selected.id}...` });
  const detail = await client.getDataset(selected.id).catch(() => null);
  if (!detail?.dataset) {
    return null;
  }

  return renderFieldDefinitionAnswer(detail.dataset, fieldName);
}

function isDatasetSelectionFromTopicQuestion(input: string) {
  const lower = input.toLowerCase();
  return /\bwhich dataset should i use\b/.test(lower)
    && !/\b(?:using|use|on)\s+[a-z0-9][a-z0-9_-]*\b/.test(lower);
}

function planningProgressLabel(input: string) {
  const lower = input.toLowerCase();
  if (isDatasetSelectionFromTopicQuestion(input)) {
    return "Looking up candidate datasets...";
  }
  if (/\bdescribe\b.*\bdataset\b|\bdataset\b.*\bdescribe\b/.test(lower)) {
    return "Planning dataset briefing...";
  }
  if (/\b(show|list)\b.*\bdatasets?\b/.test(lower)) {
    return "Checking datasets...";
  }
  if (/\b(show|list)\b.*\bruns?\b|\bresults?\b|\bartifacts?\b/.test(lower)) {
    return "Checking prior work...";
  }
  return "Analyzing request...";
}

function datasetSelectionTopicTokens(input: string) {
  const lower = input.toLowerCase();
  const tokens = reusableEnvironmentTokens(lower);
  if (/\bhousing\b/.test(lower)) tokens.push("rent", "rents", "home", "homes", "mortgage", "zillow", "hud", "acs");
  if (/\bafford/.test(lower)) tokens.push("income", "cost", "burden", "econom", "econ");
  return [...new Set(tokens)];
}

function datasetMetadataText(dataset: RemoteDatasetSummary | RemoteDatasetDetail) {
  const profile = "profile" in dataset ? dataset.profile : null;
  const sourceText = isRecord(profile)
    ? JSON.stringify({
        sources: profile.sources ?? null,
        tables: profile.tables ?? null,
        timeCoverage: profile.timeCoverage ?? null,
        geographyCoverage: profile.geographyCoverage ?? null,
        limitations: profile.limitations ?? null,
        notes: profile.notes ?? null,
        briefingMarkdown: profile.briefingMarkdown ?? null,
      }).toLowerCase()
    : "";
  return [dataset.id, dataset.name, sourceText].filter(Boolean).join(" ").toLowerCase();
}

function scoreDatasetForTopic(dataset: RemoteDatasetSummary | RemoteDatasetDetail, topicTokens: string[]) {
  const metadata = datasetMetadataText(dataset);
  let score = 0;
  for (const token of topicTokens) {
    if (metadata.includes(token)) score += 2;
  }
  if (/\becon(?:omic)?s?\b/.test(metadata)) score += 2;
  if (/\bhousing\b|\brent\b|\bincome\b|\bhome\b|\bmortgage\b/.test(metadata)) score += 3;
  if ((dataset.status ?? "").toLowerCase() === "ready") score += 1;
  if ((dataset.deploymentStatus ?? "").toLowerCase() === "ready") score += 1;
  return score;
}

function summarizeDatasetEvidence(dataset: RemoteDatasetSummary | RemoteDatasetDetail) {
  const metadata = datasetMetadataText(dataset);
  const evidence: string[] = [];
  if (/\bacs\b|american community survey|census/.test(metadata)) evidence.push("ACS/Census coverage");
  if (/\bhud\b|fair market rent|income limits|chas/.test(metadata)) evidence.push("HUD affordability benchmarks");
  if (/\bzillow\b|zori\b|zhvi\b|rent\b|home value/.test(metadata)) evidence.push("housing market rent/home value series");
  if (/\bincome\b/.test(metadata)) evidence.push("income measures");
  if (/\bhousing\b|\bafford/.test(metadata)) evidence.push("housing affordability focus");
  if (evidence.length === 0 && /\becon(?:omic)?s?\b/.test(metadata)) evidence.push("broader economics coverage");
  return evidence.slice(0, 3);
}

function summarizeDatasetTradeoff(dataset: RemoteDatasetSummary | RemoteDatasetDetail) {
  const evidence = summarizeDatasetEvidence(dataset);
  if (evidence.length > 0) {
    return evidence.join(", ");
  }
  const status = (dataset.status ?? dataset.deploymentStatus ?? "available").toLowerCase();
  return `available in RESEARCH (${status})`;
}

function firstProfileNoteSentence(dataset: RemoteDatasetSummary | RemoteDatasetDetail) {
  const profile = "profile" in dataset && isRecord(dataset.profile) ? dataset.profile : null;
  const notes = typeof profile?.notes === "string" ? profile.notes.trim() : "";
  if (!notes) return null;
  const sentence = notes.split(/(?<=[.!?])\s+/u)[0]?.trim() ?? "";
  return sentence || null;
}

function datasetCoverageSummary(dataset: RemoteDatasetSummary | RemoteDatasetDetail) {
  const profile = "profile" in dataset && isRecord(dataset.profile) ? dataset.profile : null;
  if (!profile) return null;
  const timeCoverage = isRecord(profile.timeCoverage) ? profile.timeCoverage as Record<string, unknown> : null;
  const geographyCoverage = isRecord(profile.geographyCoverage) ? profile.geographyCoverage as Record<string, unknown> : null;
  const timeRange = [timeCoverage?.start, timeCoverage?.end]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" to ");
  const geography = [geographyCoverage?.level, geographyCoverage?.grain, geographyCoverage?.summary]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0)
    ?.trim();
  const parts = [
    geography ? `geography: ${geography}` : "",
    timeRange ? `time: ${timeRange}` : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join("; ") : null;
}

function describeDatasetForRecommendation(dataset: RemoteDatasetSummary | RemoteDatasetDetail) {
  const note = firstProfileNoteSentence(dataset);
  if (note) return note;
  const evidence = summarizeDatasetEvidence(dataset);
  if (evidence.length > 0) {
    return `${dataset.name || dataset.id} covers ${evidence.join(", ")}.`;
  }
  return `${dataset.name || dataset.id} is available in RESEARCH, but its profile does not yet expose topic-specific detail.`;
}

function rankGapSummary(dataset: RemoteDatasetSummary | RemoteDatasetDetail, topScore: number, score: number) {
  const status = (dataset.status ?? dataset.deploymentStatus ?? "").toLowerCase();
  if (status && status !== "ready") {
    return `not ready yet (${status})`;
  }
  if (score <= 0) {
    return "metadata does not clearly connect it to housing affordability";
  }
  if (score < topScore) {
    return "looks adjacent, but the metadata is less directly tied to affordability measures than the top match";
  }
  return "another strong match";
}

function extractRequestedDatasetReference(input: string) {
  const explicitDescribe = input.match(/\b(?:describe|inspect|brief|profile|document)\s+(?:the\s+)?dataset\s+([a-z0-9][a-z0-9_-]*)(?:[.\s]|$)/iu);
  if (explicitDescribe?.[1]) {
    return explicitDescribe[1].toLowerCase();
  }
  const datasetMention = input.match(/\b(?:the\s+)?([a-z0-9][a-z0-9_-]*)\s+dataset\b/iu);
  if (datasetMention?.[1]) {
    return datasetMention[1].toLowerCase();
  }
  const onOrUsing = input.match(/\b(?:on|using|analyze|inspect|describe)\s+([a-z0-9][a-z0-9_-]*)(?:[.\s]|$)/iu);
  return onOrUsing?.[1]?.toLowerCase() ?? null;
}

type SpecificViralTweetsRequest = {
  datasetId: string;
  metricField: string;
  thresholdPercent: number;
  sampleSize: number;
  labelFields: string[];
  wantsBarChart: boolean;
  representativeExamples: number;
};

function parseSpecificViralTweetsRequest(input: string): SpecificViralTweetsRequest | null {
  const explicitUsingMatch = input.match(/\busing\s+([a-z0-9][a-z0-9_-]*)(?:,|\s)/iu);
  const datasetId = explicitUsingMatch?.[1]?.toLowerCase() ?? extractRequestedDatasetReference(input);
  const lower = input.toLowerCase();
  if (!datasetId || !/\bviral tweets?\b/.test(lower)) {
    return null;
  }
  const thresholdMatch = input.match(/\btop\s+(\d+(?:\.\d+)?)%\s+by\s+([a-z][a-z0-9_]*)\b/i);
  const sampleMatch = input.match(/\b(?:randomly\s+)?sample\s+(\d+)\s+viral tweets?\b/i);
  const examplesMatch = input.match(/\b(\d+)\s+representative examples\b/i);
  const labelMatch = input.match(/\blabel each for\s+(.+?)\s+using strict json\b/i);
  if (!thresholdMatch?.[1] || !thresholdMatch[2] || !sampleMatch?.[1] || !labelMatch?.[1]) {
    return null;
  }
  const labelFields = labelMatch[1]
    .split(/,|\band\b/iu)
    .map((value) => value.trim().replace(/[^a-z0-9_]/gi, "").toLowerCase())
    .filter((value) => value.length > 0);
  if (labelFields.length === 0) {
    return null;
  }
  return {
    datasetId,
    metricField: thresholdMatch[2].toLowerCase(),
    thresholdPercent: Number(thresholdMatch[1]),
    sampleSize: Number(sampleMatch[1]),
    labelFields,
    wantsBarChart: /\bbar chart\b/i.test(input),
    representativeExamples: Number(examplesMatch?.[1] ?? "0"),
  };
}

function remoteDatasetFieldNames(dataset: RemoteDatasetDetail) {
  const profileFields = schemaFieldNames(dataset.profile?.schema);
  const recordDataset = dataset as Record<string, unknown>;
  const rawFields = recordDataset.fields;
  const explicitFields = Array.isArray(rawFields)
    ? rawFields
      .map((field: unknown) => typeof field === "string" ? field.trim() : "")
      .filter((field) => field.length > 0)
    : [];
  return [...new Set([...profileFields, ...explicitFields].map((field) => field.toLowerCase()))];
}

function datasetSelectionProgressLine(dataset: RemoteDatasetSummary | RemoteDatasetDetail) {
  const lifecycle = formatDatasetLifecycleLabel(dataset.status, dataset.deploymentStatus);
  const detail = lifecycle === "ready to use" ? "ready" : lifecycle;
  return `Dataset selected: ${dataset.id} (${detail}).`;
}

function buildSpecificViralTweetsRunPrompt(request: SpecificViralTweetsRequest) {
  const labelList = request.labelFields.map((field) => `\`${field}\``).join(", ");
  const outputLines = [
    request.wantsBarChart ? "- a bar chart summarizing the label distribution" : null,
    request.representativeExamples > 0 ? `- ${request.representativeExamples} representative tweet examples with their labels` : null,
    "- a strict JSON result bundle for every labeled sample row",
  ].filter(Boolean) as string[];
  return [
    `Use the mounted dataset \`${request.datasetId}\` for this analysis.`,
    `Define viral tweets as the top ${request.thresholdPercent}% by \`${request.metricField}\`.`,
    `Randomly sample ${request.sampleSize} viral tweets.`,
    `For each sampled tweet, assign strict JSON labels for ${labelList}.`,
    "Keep the output schema deterministic and machine-readable.",
    "Work only from the mounted dataset fields; if a requested field is unavailable, say so explicitly in the summary and continue with the fields that are available.",
    "Produce these outputs:",
    ...outputLines,
  ].join("\n");
}

async function maybeHandleSpecificViralTweetsExperiment(
  input: string,
  initialSession: SessionRecord | null,
  emit: (message: AgentMessage) => void,
  deps: AgentRuntimeDeps,
) {
  if (!initialSession) {
    return null;
  }
  const request = parseSpecificViralTweetsRequest(input);
  if (!request) {
    return null;
  }

  const client = deps.createRemoteClient(initialSession);
  emit({ role: "tool", content: "Checking remote datasets..." });
  const listed = await client.listDatasets().catch(() => null);
  if (!listed?.datasets?.length) {
    return "I could not verify that the requested dataset exists in RESEARCH, so I did not start the run. Ask `show my datasets` if you want the current remote inventory first.";
  }

  const selected = chooseDatasetBriefingTarget(request.datasetId, listed.datasets);
  if (!selected) {
    return `I could not find a dataset matching \`${request.datasetId}\`, so I did not start the run. Ask \`show my datasets\` to inspect the available dataset ids.`;
  }

  emit({ role: "tool", content: datasetSelectionProgressLine(selected) });
  emit({ role: "tool", content: `Planning run: sample ${request.sampleSize} viral tweets, label strict JSON, build ${request.wantsBarChart ? "a bar chart" : "outputs"}, and return ${request.representativeExamples} examples.` });

  const ready = normalizeRemoteDatasetState(selected) === "ready";
  if (!ready) {
    return [
      `I accepted the experiment design, but I did not start the run because \`${selected.id}\` is ${formatDatasetLifecycleLabel(selected.status, selected.deploymentStatus)}.`,
      `Dataset: ${selected.id}`,
      `State: ${selected.status ?? selected.deploymentStatus ?? "unknown"}`,
      "Planned work once it is ready: filter the top 0.1% by `quote_tweet_count`, randomly sample 100 tweets, label strict JSON for `hook_type`, `emotional_tone`, and `controversy_level`, then produce a bar chart and 10 representative examples.",
      "Next: wait for the dataset to finish uploading/deploying, then rerun the same prompt.",
    ].join("\n");
  }

  emit({ role: "tool", content: `Inspecting dataset ${selected.id}...` });
  const detail = await client.getDataset(selected.id).catch(() => null);
  if (!detail?.dataset) {
    return `I found \`${selected.id}\` and it appears ready, but I could not inspect its metadata to verify the requested fields. Retry once dataset inspection is available.`;
  }

  const availableFields = remoteDatasetFieldNames(detail.dataset);
  const requestedFields = [request.metricField, ...request.labelFields];
  const missingFields = requestedFields.filter((field) => !availableFields.includes(field.toLowerCase()));
  const fieldStatusLine = missingFields.length > 0
    ? `Field check: missing ${missingFields.map((field) => `\`${field}\``).join(", ")}. I will warn in the run summary if those fields are unavailable.`
    : `Field check: confirmed ${requestedFields.map((field) => `\`${field}\``).join(", ")}.`;
  emit({ role: "tool", content: fieldStatusLine });

  const toolContext: ToolExecutionContext = {
    session: initialSession,
    sessionId: null,
    emit,
    deps,
  };
  const target = await resolveRunnableEnvironmentDataset(toolContext, client, request.datasetId, { datasetId: request.datasetId, prompt: input });
  const datasetId = target.datasetId;
  emit({ role: "tool", content: summarizeResolvedDataset(target, "this analysis") });
  emit({ role: "tool", content: `Starting remote analysis for ${datasetId}...` });

  let result;
  try {
    result = await client.startRun(datasetId, withMountedDatasetGroundingPrompt(datasetId, buildSpecificViralTweetsRunPrompt(request)), {
      type: "transform",
      config: withStandardAnalysisResources({
        scriptOutline: [
          `Compute viral threshold as the top ${request.thresholdPercent}% of rows by ${request.metricField}.`,
          `Randomly sample ${request.sampleSize} viral tweets after thresholding.`,
          `Label each sampled tweet with strict JSON fields: ${request.labelFields.join(", ")}.`,
          request.wantsBarChart ? "Render a bar chart from the label counts." : null,
          request.representativeExamples > 0 ? `Return ${request.representativeExamples} representative labeled examples.` : null,
          missingFields.length > 0 ? `Warn explicitly if these requested fields are unavailable: ${missingFields.join(", ")}.` : null,
        ].filter(Boolean).join("\n"),
      }, datasetId),
    });
  } catch (error) {
    if (error instanceof RemoteRequestError) {
      const summary = summarizeBusyDatasetConflict(error, {
        target,
        purpose: "this viral-tweets analysis",
        expectedArtifacts: ["bar chart", "structured JSON results", "representative examples"],
      });
      if (summary) {
        return summary;
      }
    }
    throw error;
  }

  if (initialSession) {
    await trackRemoteRun({
      id: result.run.id,
      datasetId: result.run.datasetId,
      origin: initialSession.origin,
      status: result.run.status,
      prompt: result.run.prompt,
      createdAt: result.run.createdAt,
      updatedAt: result.run.updatedAt,
    });
    spawnRunWatcher(result.run.id);
  }

  const summaryLines = [
    `Started remote analysis on ${result.run.datasetId}.`,
    `Dataset: ${result.run.datasetId}`,
    `Run: ${result.run.id}`,
    asyncRunStateLine(result.run.status),
    `Plan: top ${request.thresholdPercent}% by \`${request.metricField}\`, random sample ${request.sampleSize}, strict JSON labels for ${request.labelFields.map((field) => `\`${field}\``).join(", ")}, then produce ${request.wantsBarChart ? "a bar chart" : "analysis outputs"}${request.representativeExamples > 0 ? ` and ${request.representativeExamples} representative examples` : ""}.`,
    missingFields.length > 0
      ? `Warning: requested fields not verified in dataset metadata: ${missingFields.map((field) => `\`${field}\``).join(", ")}. The run will need to confirm them at execution time.`
      : "Field check: the requested metric and label fields were verified in dataset metadata before launch.",
    "Expected artifacts: bar chart, structured JSON results, representative examples.",
    "Next: the run will keep processing in the background. Follow it in the dashboard or ask `research show active runs`.",
    `Dashboard: ${dashboardRunUrl(initialSession.origin, result.run.id)}`,
  ];
  return summaryLines.join("\n");
}

function matchesDatasetReference(dataset: RemoteDatasetSummary, reference: string) {
  const normalizedName = `${dataset.id} ${dataset.name}`.toLowerCase();
  return dataset.id.toLowerCase() === reference || normalizedName.includes(reference);
}

function shouldHandleDatasetBriefingRequest(input: string) {
  const lower = input.trim().toLowerCase();
  if (!/\bdataset\b/.test(lower) || !extractRequestedDatasetReference(input)) {
    return false;
  }
  if (/\b(analy[sz]e|analysis|hypothesis|experiment|trend|why|compare|correlation|predict)\b/.test(lower)) {
    return false;
  }
  return /\b(describe|brief|briefing|document|documentation|profile|inventory|what is inside|what's inside|inspect)\b/.test(lower);
}

function chooseDatasetBriefingTarget(reference: string, datasets: RemoteDatasetSummary[]) {
  const normalized = reference.toLowerCase();
  return datasets.find((dataset) => dataset.id.toLowerCase() === normalized)
    ?? datasets.find((dataset) => dataset.name?.trim().toLowerCase() === normalized)
    ?? datasets.find((dataset) => matchesDatasetReference(dataset, normalized))
    ?? null;
}

async function startDatasetBriefingRun(
  context: ToolExecutionContext,
  input: Record<string, unknown>,
): Promise<AgentToolResult> {
  const client = createRemoteClient(context);
  const target = await resolveRunnableEnvironmentDataset(context, client, String(input.datasetId), input);
  const datasetId = target.datasetId;
  context.emit({ role: "tool", content: summarizeResolvedDataset(target, "this briefing") });
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
      const conflict = parseBusyDatasetConflict(error);
      if (conflict) {
        const existing = typeof client.getDataset === "function"
          ? await withAuthRetry(context, () => client.getDataset(datasetId).catch(() => null))
          : null;
        const fallback = existing?.dataset ? formatDatasetProfileFallback(existing.dataset, conflict) : null;
        if (fallback) {
          return {
            summary: fallback,
            data: {
              ok: true,
              reusedSavedProfile: true,
              blockingRunId: conflict.runId,
              dataset: existing?.dataset,
            },
          };
        }
        const summary = summarizeBusyDatasetConflict(error, {
          target,
          purpose: "this dataset briefing",
          expectedArtifacts: DATASET_BRIEFING_ARTIFACTS.map((artifact) => artifact.title),
        });
        return {
          summary: summary ?? [
            `Blocked: ${datasetId} is already busy.`,
            `Holding run: ${conflict.runId} (${conflict.status})`,
            "A saved dataset briefing is not available yet.",
            `Next: research debug run ${conflict.runId}`,
          ].join("\n"),
          data: { ok: false, reason: "dataset_busy", blockingRunId: conflict.runId },
        };
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
    summary: `Started dataset briefing run ${result.run.id} for ${datasetId}. Expected artifacts: Dataset Briefing, Dataset Profile. Dashboard: ${dashboardRunUrl(requireSession(context).origin, result.run.id)}`,
    data: result,
  };
}

function takeStringList(value: unknown, limit = 3) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") return entry.trim();
      if (isRecord(entry)) {
        return String(entry.name ?? entry.title ?? entry.label ?? entry.id ?? "").trim();
      }
      return "";
    })
    .filter(Boolean)
    .slice(0, limit);
}

function vagueInterestingDirections(detail: RemoteDatasetDetail) {
  const topicText = `${detail.id} ${detail.name} ${detail.profile?.notes ?? ""} ${detail.profile?.briefingMarkdown ?? ""}`.toLowerCase();
  if (/\bhousing|mortgage|permit|county\b/.test(topicText)) {
    return ["rate sensitivity", "coverage quality", "regional differences"];
  }
  if (/\btweet|social|engagement\b/.test(topicText)) {
    return ["engagement drivers", "coverage quality", "time trends"];
  }
  return ["coverage quality", "time trends", "segment differences"];
}

function describeInterestingDirection(direction: string) {
  switch (direction) {
    case "rate sensitivity":
      return "how the headline metrics move when rates change";
    case "coverage quality":
      return "missingness, completeness, and where the panel is thin";
    case "regional differences":
      return "which places move differently from the national pattern";
    case "engagement drivers":
      return "which signals line up with outsized engagement";
    case "time trends":
      return "how the core metrics shift over time";
    case "segment differences":
      return "which groups or slices diverge the most";
    default:
      return "a narrowly scoped read-only slice";
  }
}

function summarizeInterestingDataset(detail: RemoteDatasetDetail) {
  const profile = detail.profile;
  const headerName = detail.name?.trim() || detail.id;
  const sourceNames = takeStringList(profile?.sources, 3);
  const tableNames = takeStringList(profile?.tables, 2);
  const coverageText = typeof profile?.notes === "string" ? profile.notes.trim() : "";
  const limitationText = Array.isArray(profile?.limitations)
    ? profile.limitations
      .map((entry: unknown) => typeof entry === "string" ? entry.trim() : isRecord(entry) ? String(entry.summary ?? entry.title ?? entry.name ?? "").trim() : "")
      .filter(Boolean)
      .slice(0, 2)
      .join("; ")
    : "";
  const timeCoverage = isRecord(profile?.timeCoverage) ? profile?.timeCoverage as Record<string, unknown> : null;
  const timeRange = timeCoverage
    ? [timeCoverage.start, timeCoverage.end].filter((value) => typeof value === "string" && value.trim()).join(" to ")
    : "";
  const geographyCoverage = isRecord(profile?.geographyCoverage) ? profile?.geographyCoverage as Record<string, unknown> : null;
  const geographyLabel = geographyCoverage
    ? String(geographyCoverage.level ?? geographyCoverage.grain ?? geographyCoverage.summary ?? "").trim()
    : "";
  const directions = vagueInterestingDirections(detail);
  const strongestAngle = directions[0] ?? "coverage quality";
  const lines = [
    "I can give you a quick dataset briefing first, then narrow into one question if you want.",
    "",
    `${headerName} is a plausible fit for a first pass because it already looks structured for ${strongestAngle}.`,
  ];
  if (sourceNames.length > 0) {
    lines.push(`- It combines ${sourceNames.join(", ")}${tableNames.length > 0 ? ` into ${tableNames.join(" and ")}` : ""}.`);
  }
  if (timeRange || geographyLabel || coverageText) {
    const parts = [timeRange ? `Time range: ${timeRange}` : "", geographyLabel ? `Geography: ${geographyLabel}` : "", coverageText || ""].filter(Boolean);
    lines.push(`- ${parts.join("; ")}.`);
  }
  if (limitationText) {
    lines.push(`- Main caution: ${limitationText}.`);
  }
  lines.push("");
  lines.push("If you want to drill in, pick one read-only next step:");
  for (const direction of directions) {
    lines.push(`- ${direction}: ${describeInterestingDirection(direction)}. Cost: one small read-only pass.`);
  }
  lines.push("");
  lines.push("Reply with one of those angles, or say `briefing only` if you just want the dataset summary.");
  lines.push("I will not start a broad remote analysis until you choose the scope.");
  return lines.join("\n");
}

async function maybeHandleDatasetSelectionFromTopic(
  input: string,
  initialSession: SessionRecord | null,
  emit: (message: AgentMessage) => void,
  deps: AgentRuntimeDeps,
) {
  if (!initialSession || !isDatasetSelectionFromTopicQuestion(input)) {
    return null;
  }

  emit({ role: "tool", content: "Looking up candidate datasets..." });
  const client = deps.createRemoteClient(initialSession);
  const listed = await client.listDatasets().catch(() => ({ datasets: [] }));
  if (listed.datasets.length === 0) {
    return [
      "I do not see any remote datasets in RESEARCH yet for this topic.",
      "",
      "Need from you",
      "- Which geography matters most: nationwide, state, metro, county, or tract?",
      "- If you want, I can help design the right housing-affordability dataset after that.",
    ].join("\n");
  }

  const topicTokens = datasetSelectionTopicTokens(input);
  const rankedSummaries = [...listed.datasets]
    .map((dataset) => ({ dataset, score: scoreDatasetForTopic(dataset, topicTokens) }))
    .sort((left, right) => right.score - left.score || String(right.dataset.createdAt ?? "").localeCompare(String(left.dataset.createdAt ?? "")));
  const inspectionPool = rankedSummaries.slice(0, Math.min(3, rankedSummaries.length));
  const inspected = await Promise.all(inspectionPool.map(async ({ dataset, score }) => {
    const detail = typeof client.getDataset === "function" ? await client.getDataset(dataset.id).catch(() => null) : null;
    const enriched = detail?.dataset ?? dataset;
    return { dataset: enriched, score: Math.max(score, scoreDatasetForTopic(enriched, topicTokens)) };
  }));
  const ranked = inspected
    .sort((left, right) => right.score - left.score || String(right.dataset.createdAt ?? "").localeCompare(String(left.dataset.createdAt ?? "")));
  const primary = ranked[0]?.dataset ?? rankedSummaries[0]?.dataset;
  if (!primary) {
    return null;
  }
  const supplements = ranked
    .slice(1)
    .filter((entry) => entry.score >= Math.max(2, (ranked[0]?.score ?? 0) - 2))
    .slice(0, 2);
  const evidence = summarizeDatasetEvidence(primary);
  const primaryDescription = describeDatasetForRecommendation(primary);
  const primaryCoverage = datasetCoverageSummary(primary);
  const primaryWhy = evidence.length > 0
    ? `${primary.name || primary.id} is the strongest current match because its metadata points to ${evidence.join(", ")}.`
    : `${primary.name || primary.id} is the closest current match by dataset metadata and availability in RESEARCH.`;

  const lines = [
    "Need one detail to finalize",
    `- Start with \`${primary.id}\`${primary.name && primary.name !== primary.id ? ` (${primary.name})` : ""}. It is the best current base for housing-affordability research in RESEARCH.`,
    "",
    "Best existing dataset",
    `- Plain-English description: ${primaryDescription}`,
    ...(primaryCoverage ? [`- Coverage snapshot: ${primaryCoverage}.`] : []),
    "",
    "Why it wins",
    `- ${primaryWhy}`,
    "- Housing affordability usually depends on the exact geography and the signal you care about most: rent burden, home-price-to-income, or a broader cost-pressure proxy.",
    `- ${primary.id} is the best starting point because it already looks like a reusable base rather than a net-new build.`,
  ];
  if (ranked.length > 1) {
    lines.push("", "Other candidates I checked");
    for (const entry of ranked.slice(1, 3)) {
      const description = describeDatasetForRecommendation(entry.dataset);
      const gap = rankGapSummary(entry.dataset, ranked[0]?.score ?? entry.score, entry.score);
      lines.push(
        `- \`${entry.dataset.id}\`${entry.dataset.name && entry.dataset.name !== entry.dataset.id ? ` (${entry.dataset.name})` : ""}: ${description} Why not first: ${gap}.`,
      );
    }
  } else {
    lines.push("", "Other candidates I checked", `- I only found one strong match. I do not see another ready dataset that maps to housing affordability as directly as \`${primary.id}\`.`);
  }
  lines.push(
    "",
    "What's missing",
    "- I still need your target geography before I can tell you whether this dataset is already sufficient or whether it needs extension for your version of affordability.",
    "- After that answer, I can decide whether to use the existing dataset as-is, inspect one narrower alternative, or recommend a focused build extension.",
    "",
    "Questions needed",
    "- Which geography matters most?",
    "- Reply with one choice: `1 nationwide`, `2 state`, `3 metro`, `4 county`, or `5 tract`.",
    "- If you do not care, reply `1` and I will default to nationwide.",
  );
  return lines.join("\n");
}

async function maybeHandleVagueDatasetInterestingQuestion(
  input: string,
  initialSession: SessionRecord | null,
  emit: (message: AgentMessage) => void,
  deps: AgentRuntimeDeps,
) {
  const lower = input.toLowerCase();
  if (!initialSession || !/\bdataset\b/.test(lower) || !/\binterest(?:ing)?\b/.test(lower) || !/\banaly[sz]e\b/.test(lower)) {
    return null;
  }
  const reference = extractRequestedDatasetReference(input);
  if (!reference) {
    return null;
  }
  const client = deps.createRemoteClient(initialSession);
  const listed = await client.listDatasets().catch(() => null);
  if (!listed) {
    return null;
  }
  const selected = listed.datasets.find((dataset) => matchesDatasetReference(dataset, reference));
  if (!selected) {
    return null;
  }
  const detail = await client.getDataset(selected.id).catch(() => null);
  if (!detail?.dataset) {
    return null;
  }
  return summarizeInterestingDataset(detail.dataset);
}

async function maybeHandleDatasetBriefingRequest(
  input: string,
  initialSession: SessionRecord | null,
  emit: (message: AgentMessage) => void,
  deps: AgentRuntimeDeps,
) {
  if (!initialSession || !shouldHandleDatasetBriefingRequest(input)) {
    return null;
  }
  const reference = extractRequestedDatasetReference(input);
  if (!reference) {
    return null;
  }
  const client = deps.createRemoteClient(initialSession);
  if (typeof client.listDatasets !== "function") {
    return null;
  }
  emit({ role: "tool", content: "Searching datasets..." });
  const listed = await client.listDatasets().catch(() => null);
  if (!listed) {
    return null;
  }
  const selected = chooseDatasetBriefingTarget(reference, listed.datasets);
  if (!selected) {
    return `I could not find a dataset matching \`${reference}\`. Ask \`show my datasets\` to inspect what is available.`;
  }
  emit({
    role: "tool",
    content: `Selected ${selected.id} for this briefing${selected.name?.trim() && selected.name.trim().toLowerCase() !== selected.id.toLowerCase() ? ` (${selected.name.trim()})` : ""}.`,
  });
  const toolContext: ToolExecutionContext = {
    session: initialSession,
    sessionId: null,
    emit,
    deps,
  };
  emit({ role: "tool", content: "Generating dataset briefing..." });
  const result = await startDatasetBriefingRun(toolContext, { datasetId: selected.id });
  const resultData = isRecord(result.data) ? result.data : {};
  if (resultData.ok === false || resultData.reusedSavedProfile === true) {
    return result.summary;
  }
  return asyncRunLaunchSummary("describe_remote_dataset", result, toolContext);
}

function shouldHandleDatasetInventory(input: string) {
  const lower = input.trim().toLowerCase();
  return (
    /\b(what data do i already have|what datasets do i have|show (?:my )?datasets|list (?:my )?datasets|dataset inventory)\b/.test(lower)
    || (/\bready to use\b/.test(lower) && /\bdata|dataset/.test(lower))
  );
}

async function maybeHandleDatasetInventory(input: string, initialSession: SessionRecord | null, deps: AgentRuntimeDeps) {
  if (!initialSession || !shouldHandleDatasetInventory(input)) {
    return null;
  }
  const localInstances = await deps.listLocalDatasets().catch(() => []);
  const client = deps.createRemoteClient(initialSession);
  const remoteDatasets = await client.listDatasets().then((payload) => payload.datasets).catch(() => []);
  const includeHidden = wantsAllDatasets(input);
  return {
    localCount: localInstances.length,
    remoteCount: remoteDatasets.length,
    response: formatDatasetInventoryResponse(localInstances, remoteDatasets, includeHidden),
  };
}

function extractDatasetIdFromNewAnalysis(input: string) {
  const match = input.match(/\b(?:on|using)\s+([a-z0-9][a-z0-9_-]*)(?:[.\s]|$)/iu);
  return match?.[1] ?? null;
}

async function maybeHandleBusyDatasetBeforePlanning(
  input: string,
  initialSession: SessionRecord | null,
  deps: AgentRuntimeDeps,
) {
  const lower = input.toLowerCase();
  if (!initialSession || !/\b(new analysis|run.*analysis|start.*analysis)\b/.test(lower)) {
    return null;
  }
  const requestedDatasetId = extractDatasetIdFromNewAnalysis(input);
  if (!requestedDatasetId) {
    return null;
  }
  const client = deps.createRemoteClient(initialSession);
  const remoteDatasets = typeof client.listDatasets === "function"
    ? await client.listDatasets().catch(() => null)
    : null;
  const matchedDataset = remoteDatasets
    ? chooseDatasetBriefingTarget(requestedDatasetId, remoteDatasets.datasets)
    : null;
  const datasetId = matchedDataset?.id ?? requestedDatasetId;

  const remoteRuns = typeof client.listRuns === "function"
    ? await client.listRuns(datasetId).catch(() => null)
    : null;
  const remoteActive = remoteRuns?.runs.find((run) => !isTerminalRunStatus(run.status));
  if (remoteActive) {
    return [
      renderBusyDatasetConflict({
        datasetId,
        runId: remoteActive.id,
        status: remoteActive.status,
        createdAt: remoteActive.createdAt,
        updatedAt: remoteActive.updatedAt,
        dashboardUrl: dashboardRunUrl(initialSession.origin, remoteActive.id),
      }),
      remoteActive.prompt?.trim() ? `Current work: ${remoteActive.prompt.trim()}` : null,
    ].filter(Boolean).join("\n");
  }

  const runs = await deps.readTrackedRuns().catch(() => []);
  const active = runs.find((run) => run.datasetId === datasetId && !run.terminalAt && !isTerminalRunStatus(run.status));
  if (!active) {
    return null;
  }
  return renderBusyDatasetConflict({
    datasetId,
    runId: active.id,
    status: active.status,
    createdAt: active.createdAt,
    updatedAt: active.updatedAt,
    dashboardUrl: active.dashboardUrl ?? dashboardRunUrl(active.origin, active.id),
  });
}

function summarizeTrackedRunWork(run: { datasetId: string; prompt?: string; lastEventMessage?: string }) {
  const latest = run.lastEventMessage?.trim();
  if (latest) {
    return summarizeRunEventForHumans(latest);
  }
  const firstPromptLine = run.prompt?.split("\n")[0]?.trim();
  if (!firstPromptLine) {
    return "Remote processing is in progress.";
  }
  if (/mounted dataset grounding is mandatory/i.test(firstPromptLine)) {
    return `Waiting for dataset ${run.datasetId} to be mounted so the run can start reading it.`;
  }
  return firstPromptLine.endsWith(".") ? firstPromptLine : `${firstPromptLine}.`;
}

function summarizeRunEventForHumans(message: string) {
  if (/Remote agent droplet .* launched in /i.test(message)) {
    return "Worker started and is still getting ready.";
  }
  if (/mounted dataset grounding is mandatory/i.test(message)) {
    return "Waiting for the dataset mount before analysis can start.";
  }
  return message.endsWith(".") ? message : `${message}.`;
}

function describeRunDiagnosis(status: string | undefined, minutesSinceUpdate: number | null) {
  const normalized = (status ?? "").toLowerCase();
  if (minutesSinceUpdate === null) {
    return "I can see an active run, but I do not have a reliable heartbeat yet.";
  }
  if (normalized === "booting") {
    if (minutesSinceUpdate <= 2) {
      return "Still booting. That is normal while the worker starts and mounts the dataset.";
    }
    return "Still booting, but it has gone quiet longer than expected, so it may be stalled.";
  }
  if (normalized === "queued") {
    if (minutesSinceUpdate <= 2) {
      return "Still queued. That usually means the run is waiting for capacity.";
    }
    return "Still queued with no recent progress, so it may be waiting on capacity.";
  }
  if (normalized === "running") {
    if (minutesSinceUpdate <= 2) {
      return "Still running. Recent updates suggest the worker is making progress.";
    }
    return "Still running, but there have been no recent updates, so it may be stalled.";
  }
  if (minutesSinceUpdate <= 2) {
    return `Still ${formatStatusForHumans(status)}. Recent updates suggest it is not stuck yet.`;
  }
  return `Still ${formatStatusForHumans(status)}, but it has been quiet long enough that it may be stalled.`;
}

function formatHeartbeat(minutesSinceUpdate: number | null) {
  if (minutesSinceUpdate === null) return "unknown";
  if (minutesSinceUpdate < 1) return "less than 1 minute ago";
  if (minutesSinceUpdate === 1) return "1 minute ago";
  return `${minutesSinceUpdate} minutes ago`;
}

function formatElapsedDuration(ms: number | null) {
  if (ms === null || !Number.isFinite(ms)) return "unknown";
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}

function recommendedRunAction(runId: string, minutesSinceUpdate: number | null) {
  if (minutesSinceUpdate === null || minutesSinceUpdate >= 2) {
    return `Next: run \`research debug run ${runId}\` now.`;
  }
  return `Next: give it up to 2 minutes total. If there is still no new event, run \`research debug run ${runId}\`.`;
}

async function maybeHandleStuckRunQuestion(input: string, initialSession: SessionRecord | null, deps: AgentRuntimeDeps) {
  const lower = input.toLowerCase();
  if (!initialSession || !/\blast run\b/.test(lower) || !/\b(stuck|happening|progress|status)\b/.test(lower)) {
    return null;
  }
  const runs = await deps.readTrackedRuns().catch(() => []);
  const active = runs.find((run) => !run.terminalAt && !isTerminalRunStatus(run.status));
  if (!active) {
    return "I do not see an active tracked run right now. Ask `show results from my last run` to inspect the latest completed one.";
  }
  const updated = active.updatedAt ? new Date(active.updatedAt).getTime() : NaN;
  const minutes = Number.isFinite(updated) ? Math.max(0, Math.floor((deps.now() - updated) / 60000)) : null;
  const staleMs = Number.isFinite(updated) ? Math.max(0, deps.now() - updated) : null;
  const exactUpdatedAt = active.updatedAt ? new Date(active.updatedAt).toISOString() : null;
  const recentWork = summarizeTrackedRunWork(active);
  return [
    describeRunDiagnosis(active.status, minutes),
    "",
    `Live status: ${formatStatusForHumans(active.status)} · no new event for ${formatElapsedDuration(staleMs)}.`,
    `Last observed work: ${recentWork}`,
    "",
    recommendedRunAction(active.id, minutes),
    "",
    "Checked from your tracked run just now.",
    exactUpdatedAt ? `Last update: ${exactUpdatedAt} (${formatHeartbeat(minutes)})` : `Last update: ${formatHeartbeat(minutes)}`,
    `Dataset: ${active.datasetId}`,
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
    case "run_remote_transformation":
      return `Starting remote analysis for ${String(input.datasetId ?? "").trim() || "dataset"}...`;
    case "run_remote_labeling":
      return `Starting labeling run for ${String(input.datasetId ?? "").trim() || "dataset"}...`;
    case "create_research_environment":
    case "create_public_data_environment":
      return "Starting dataset build...";
    case "resolve_local_dataset":
      return "Resolving local file...";
    case "profile_local_dataset":
      return `Inspecting ${basename(String(input.inputPath ?? "file"))}...`;
    case "register_remote_dataset":
      return "Creating dataset...";
    case "request_dataset_source_upload":
      return "Preparing upload target...";
    case "upload_local_file":
      return `Uploading ${basename(String(input.inputPath ?? "file"))}...`;
    case "complete_dataset_source_upload":
      return "Upload complete. Verifying source...";
    case "deploy_remote_dataset":
      return `Starting deployment for ${String(input.datasetId ?? "").trim() || "dataset"}...`;
    default:
      return `Running ${toolName}...`;
  }
}

function shouldEchoToolResult(toolName: string, summary: string) {
  return !summary.startsWith("Blocked:") && !ASYNC_RUN_START_TOOLS.has(toolName);
}

function normalizeAsyncRunStatus(status: unknown) {
  const value = typeof status === "string" ? status.toLowerCase() : "";
  if (value === "booting") return "starting";
  if (value === "running") return "running";
  if (value === "queued") return "queued";
  return value || "queued";
}

function asyncRunStateLine(status: unknown) {
  const normalized = normalizeAsyncRunStatus(status);
  if (normalized === "queued") return "State: queued. The run is waiting for backend capacity.";
  if (normalized === "starting") return "State: starting. The backend worker is still initializing.";
  if (normalized === "running") return "State: running. The analysis is executing now.";
  return `State: ${normalized}.`;
}

function artifactExpectationFromTitle(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("bar chart")) return "bar chart";
  if (lower.includes("chart")) return "chart";
  if (lower.includes("example")) return "representative examples";
  if (lower.includes("json")) return "structured JSON results";
  if (lower.includes("label")) return "labeling output";
  if (lower.includes("summary") || lower.includes("report")) return "written summary";
  return title;
}

function inferArtifactExpectations(toolName: string, resultData: Record<string, unknown>, summary: string) {
  const hints = new Set<string>();
  const artifacts = Array.isArray(resultData.artifacts) ? resultData.artifacts : [];
  for (const artifact of artifacts) {
    if (!isRecord(artifact) || typeof artifact.title !== "string") continue;
    hints.add(artifactExpectationFromTitle(artifact.title));
  }
  const prompt = isRecord(resultData.run) && typeof resultData.run.prompt === "string" ? resultData.run.prompt : summary;
  const promptLower = prompt.toLowerCase();
  if (promptLower.includes("bar chart")) hints.add("bar chart");
  if (promptLower.includes("representative example")) hints.add("representative examples");
  if (promptLower.includes("strict json")) hints.add("structured JSON results");
  if (toolName === "run_remote_labeling") hints.add("labeling output");
  if (toolName === "run_remote_transformation" && hints.size === 0) hints.add("analysis outputs");
  return [...hints].slice(0, 4);
}

function asyncRunLaunchSummary(
  toolName: string,
  result: AgentToolResult,
  context: ToolExecutionContext,
) {
  if (toolName === "create_research_environment" || toolName === "create_public_data_environment" || toolName === "deploy_remote_dataset" || toolName === "deploy_local_instance") {
    return result.summary;
  }
  const resultData = isRecord(result.data) ? result.data : {};
  const run = isRecord(resultData.run) ? resultData.run : {};
  const runId = typeof run.id === "string" ? run.id : null;
  const datasetId = typeof run.datasetId === "string" ? run.datasetId : null;
  const status = normalizeAsyncRunStatus(run.status);
  const expectations = inferArtifactExpectations(toolName, resultData, result.summary);
  const stateLine = asyncRunStateLine(status);
  const headline = (() => {
    switch (toolName) {
      case "run_remote_transformation":
        return `Started remote analysis${datasetId ? ` on ${datasetId}` : ""}.`;
      case "run_remote_labeling":
        return `Started remote labeling${datasetId ? ` on ${datasetId}` : ""}.`;
      case "describe_remote_dataset":
        return `Started dataset briefing run ${runId ?? "unknown"}${datasetId ? ` for ${datasetId}` : ""}.`;
      case "create_research_environment":
        return `Started research environment build ${runId ?? "unknown"}${datasetId ? ` for ${datasetId}` : ""}.`;
      case "create_public_data_environment":
        return `Started public-data environment build ${runId ?? "unknown"}${datasetId ? ` for ${datasetId}` : ""}.`;
      case "query_remote_dataset":
        return `Started query run ${runId ?? "unknown"}${datasetId ? ` on ${datasetId}` : ""}.`;
      case "aggregate_remote_dataset":
        return `Started aggregate run ${runId ?? "unknown"}${datasetId ? ` on ${datasetId}` : ""}.`;
      default:
        return `Started run ${runId ?? "unknown"}${datasetId ? ` on ${datasetId}` : ""}.`;
    }
  })();
  const lines = [headline];
  if (runId) {
    lines.push(`Run: ${runId}`);
  }
  lines.push(stateLine);
  if (expectations.length > 0) {
    lines.push(`Expected artifacts: ${expectations.join(", ")}.`);
  } else if (toolName === "describe_remote_dataset") {
    lines.push("Expected artifacts: Dataset Briefing, Dataset Profile.");
  }
  lines.push("Next: the run will keep processing in the background. Follow it in the dashboard or ask `research show active runs`.");
  if (context.session && runId) {
    lines.push(`Dashboard: ${dashboardRunUrl(context.session.origin, runId)}`);
  }
  return lines.join("\n");
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
          summary: `Using local file ${basename(resolvedPath)}.\nPath: ${resolvedPath}`,
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
          summary: `Checked the file structure for ${basename(inputPath)}.`,
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
        properties: {
          topic: { type: "string" },
          limit: { type: "integer" },
        },
      },
      async execute(context, input) {
        const client = createRemoteClient(context);
        const datasets = await client.listDatasets();
        const topic = typeof input.topic === "string" ? input.topic.trim() : "";
        const limit = typeof input.limit === "number" ? input.limit : 3;
        const shortlist = topic ? formatDatasetShortlist(topic, datasets.datasets, limit) : null;
        return {
          summary: datasets.datasets.length > 0
            ? [
                `Found ${datasets.datasets.length} remote dataset${datasets.datasets.length === 1 ? "" : "s"}.`,
                shortlist ? `Top matches for "${topic}":\n${shortlist}` : null,
              ].filter(Boolean).join("\n")
            : "No remote datasets found; a new build will be needed if the plan proceeds.",
          data: topic
            ? {
                ...datasets,
                recommendationTopic: topic,
                shortlist: rankDatasetsForRecommendation(topic, datasets.datasets, limit),
              }
            : datasets,
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
          summary: summarizeRemoteDatasetInspection(payload.dataset),
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
      async execute(context) {
        const runs = await context.deps.readTrackedRuns();
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
          summary: `Created dataset ${name} (dataset id: ${datasetId}).`,
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
        const matchedDataset = existingDatasets.datasets.find((dataset) => dataset.id === datasetId);
        context.emit({
          role: "tool",
          content: explainEnvironmentSelection({
            requestedDatasetId,
            datasetId,
            datasetName: matchedDataset?.name,
            reusedExisting: datasetId !== requestedDatasetId,
          }),
        });
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
          summary: formatEnvironmentBuildSummary({
            buildKind: "research environment",
            datasetId: result.run.datasetId,
            datasetName: typeof input.name === "string" ? input.name : undefined,
            prompt,
            artifacts: Array.isArray(input.artifacts) ? input.artifacts as Array<Record<string, unknown>> : undefined,
            run: result.run,
            origin: requireSession(context).origin,
          }),
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
        const matchedDataset = existingDatasets.datasets.find((dataset) => dataset.id === datasetId);
        context.emit({
          role: "tool",
          content: explainEnvironmentSelection({
            requestedDatasetId,
            datasetId,
            datasetName: matchedDataset?.name,
            reusedExisting: datasetId !== requestedDatasetId,
          }),
        });
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
          summary: formatEnvironmentBuildSummary({
            buildKind: "public-data environment",
            datasetId: result.run.datasetId,
            datasetName: typeof input.name === "string" ? input.name : undefined,
            prompt,
            artifacts: Array.isArray(input.artifacts) ? input.artifacts as Array<Record<string, unknown>> : undefined,
            run: result.run,
            origin: requireSession(context).origin,
          }),
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
          summary: `Upload target ready for ${filename}.`,
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
          summary: `Finished uploading ${basename(inputPath)}.`,
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
          summary: `Source upload verified for dataset ${datasetId}.`,
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
        const runId = deployment.run?.id;
        const terminalSessionUrl = context.session && context.sessionId && runId
          ? dashboardTerminalSessionUrl(context.session.origin, context.sessionId, runId)
          : null;
        return {
          summary: [
            `Deployment started for dataset ${datasetId}.${deployment.run ? ` Run: ${deployment.run.id}.` : ""}${deployment.deployment.status ? ` Status: ${deployment.deployment.status}.` : ""}`,
            terminalSessionUrl ? `Terminal session: ${terminalSessionUrl}` : null,
          ].filter(Boolean).join("\n"),
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
        const target = await resolveRunnableEnvironmentDataset(context, client, String(input.datasetId), input);
        const datasetId = target.datasetId;
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
            const summary = summarizeBusyDatasetConflict(error, { target, purpose: "this run" });
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
        const target = await resolveRunnableEnvironmentDataset(context, client, String(input.datasetId), input);
        const datasetId = target.datasetId;
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
            const summary = summarizeBusyDatasetConflict(error, { target, purpose: "this query" });
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
        const target = await resolveRunnableEnvironmentDataset(context, client, String(input.datasetId), input);
        const datasetId = target.datasetId;
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
            const summary = summarizeBusyDatasetConflict(error, { target, purpose: "this aggregation" });
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
        const target = await resolveRunnableEnvironmentDataset(context, client, String(input.datasetId), input);
        const datasetId = target.datasetId;
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
        return startDatasetBriefingRun(context, input);
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
        const target = await resolveRunnableEnvironmentDataset(context, client, String(input.datasetId), input);
        const datasetId = target.datasetId;
        let result;
        try {
          result = await client.startRun(datasetId, withMountedDatasetGroundingPrompt(datasetId, String(input.prompt)), {
            type: "agent",
            config: withStandardAnalysisResources(undefined, datasetId),
            artifacts: Array.isArray(input.artifacts) ? input.artifacts as Array<Record<string, unknown>> : undefined,
          });
        } catch (error) {
          if (error instanceof RemoteRequestError) {
            const summary = summarizeBusyDatasetConflict(error, { target, purpose: "this remote agent run" });
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
        const target = await resolveRunnableEnvironmentDataset(context, client, String(input.datasetId), input);
        const datasetId = target.datasetId;
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
            const summary = summarizeBusyDatasetConflict(error, { target, purpose: "this transformation" });
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
        const target = await resolveRunnableEnvironmentDataset(context, client, String(input.datasetId), input);
        const datasetId = target.datasetId;
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
  const resolvedDeps = deps;
  const datasetInventoryResponse = await maybeHandleDatasetInventory(input, initialSession, resolvedDeps);
  if (datasetInventoryResponse) {
    emit({ role: "tool", content: "Checking local datasets..." });
    emit({ role: "tool", content: `Found ${datasetInventoryResponse.localCount} local dataset${datasetInventoryResponse.localCount === 1 ? "" : "s"}.` });
    emit({ role: "tool", content: "Checking remote datasets..." });
    emit({ role: "tool", content: `Found ${datasetInventoryResponse.remoteCount} remote dataset${datasetInventoryResponse.remoteCount === 1 ? "" : "s"}.` });
    emit({ role: "assistant", content: datasetInventoryResponse.response });
    return {
      sessionId: conversationState?.sessionId ?? null,
      previousResponseId: conversationState?.previousResponseId ?? null,
    };
  }

  const directResponse = getLocalDirectResponse(input);
  if (directResponse) {
    emit({ role: "assistant", content: directResponse });
    return {
      sessionId: conversationState?.sessionId ?? null,
      previousResponseId: conversationState?.previousResponseId ?? null,
    };
  }

  const specificViralTweetsResponse = await maybeHandleSpecificViralTweetsExperiment(input, initialSession, emit, deps);
  if (specificViralTweetsResponse) {
    emit({ role: "assistant", content: specificViralTweetsResponse });
    return {
      sessionId: conversationState?.sessionId ?? null,
      previousResponseId: conversationState?.previousResponseId ?? null,
    };
  }

  const fieldDefinitionResponse = await maybeHandleFieldDefinitionQuestion(input, initialSession, emit, deps);
  if (fieldDefinitionResponse) {
    emit({ role: "assistant", content: fieldDefinitionResponse });
    return {
      sessionId: conversationState?.sessionId ?? null,
      previousResponseId: conversationState?.previousResponseId ?? null,
    };
  }

  const vagueTweetsResponse = await maybeHandleVagueTweetsExperiment(input, initialSession, emit, deps);
  if (vagueTweetsResponse) {
    emit({ role: "assistant", content: vagueTweetsResponse });
    emit({ role: "tool", content: "Waiting for your approval before starting a run." });
    return {
      sessionId: conversationState?.sessionId ?? null,
      previousResponseId: conversationState?.previousResponseId ?? null,
    };
  }

  const vagueDatasetResponse = await maybeHandleVagueDatasetInterestingQuestion(input, initialSession, emit, deps);
  if (vagueDatasetResponse) {
    emit({ role: "assistant", content: vagueDatasetResponse });
    return {
      sessionId: conversationState?.sessionId ?? null,
      previousResponseId: conversationState?.previousResponseId ?? null,
    };
  }

  const datasetBriefingResponse = await maybeHandleDatasetBriefingRequest(input, initialSession, emit, deps);
  if (datasetBriefingResponse) {
    emit({ role: "assistant", content: datasetBriefingResponse });
    return {
      sessionId: conversationState?.sessionId ?? null,
      previousResponseId: conversationState?.previousResponseId ?? null,
    };
  }

  const localRunResponse = await maybeHandleStuckRunQuestion(input, initialSession, resolvedDeps)
    ?? await maybeHandleContinuityQuestion(input, initialSession, resolvedDeps)
    ?? await maybeHandleDatasetSelectionFromTopic(input, initialSession, emit, deps)
    ?? await maybeHandleLastRunResultsRequest(input, initialSession, deps, emit)
    ?? await maybeHandleBusyDatasetBeforePlanning(input, initialSession, resolvedDeps);
  if (localRunResponse) {
    emit({ role: "assistant", content: localRunResponse });
    if (/Need one detail to finalize|Questions needed|Waiting for your answer/u.test(localRunResponse)) {
      emit({ role: "tool", content: "Waiting for your reply so I can finalize the dataset recommendation." });
    }
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

  if (!context.session) {
    const signedOutRemoteDatasetRequest = maybeHandleSignedOutRemoteDatasetRequest(input);
    if (signedOutRemoteDatasetRequest) {
      emit({
        role: "assistant",
        content: signedOutRemoteDatasetRequest,
      });
      return {
        sessionId: context.sessionId,
        previousResponseId: conversationState?.previousResponseId ?? null,
      };
    }
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
      content: "Sign in first with `/login` so I can access your remote datasets, runs, and deployment work.",
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
    emit({ role: "tool", content: planningProgressLabel(input) });
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
      const expectedArtifacts = summarizeExpectedArtifacts(parsedArguments);
      if (expectedArtifacts && ASYNC_RUN_START_TOOLS.has(tool.name)) {
        emit({ role: "tool", content: expectedArtifacts });
      }
      let result: AgentToolResult;
      const startedAt = Date.now();
      let heartbeatTimer: NodeJS.Timeout | null = null;
      try {
        heartbeatTimer = setInterval(() => {
          emit({ role: "tool", content: progressHeartbeat(tool.name, parsedArguments, Math.max(1, Math.round((Date.now() - startedAt) / 1000))) });
        }, toolHeartbeatIntervalMs());
        result = await withAuthRetry(context, () => tool.execute(context, parsedArguments));
      } catch (error) {
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
        }
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
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }
      if (shouldEchoToolResult(tool.name, result.summary)) {
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
        if (resultData.ok === false) {
          emit({ role: "assistant", content: result.summary });
          await persistSessionEntry(context, {
            role: "assistant",
            kind: "local_summary",
            title: "CLI blocked",
            content: result.summary,
          });
          return {
            sessionId: context.sessionId,
            previousResponseId: conversationState?.previousResponseId ?? null,
          };
        }
        if (resultData.reusedSavedProfile === true) {
          emit({ role: "assistant", content: result.summary });
          await persistSessionEntry(context, {
            role: "assistant",
            kind: "local_summary",
            title: "CLI summary",
            content: result.summary,
          });
          return {
            sessionId: context.sessionId,
            previousResponseId: conversationState?.previousResponseId ?? null,
          };
        }
        const startedRunId = isRecord(resultData.run) && typeof resultData.run.id === "string" ? resultData.run.id : null;
        if (!startedRunId) {
          toolOutputs.push({
            type: "function_call_output",
            call_id: call.call_id ?? tool.name,
            output: JSON.stringify({
              ok: true,
              summary: result.summary,
              data: result.data,
            }),
          });
          continue;
        }
        const finalSummary = asyncRunLaunchSummary(tool.name, result, context);
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
