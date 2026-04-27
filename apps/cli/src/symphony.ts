import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { access, mkdir, readFile, rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import { Liquid } from "liquidjs";
import yaml from "js-yaml";

export type SymphonyIssue = {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  priority: number | null;
  state: string;
  branch_name: string | null;
  url: string | null;
  labels: string[];
  blocked_by: Array<{ id: string | null; identifier: string | null; state: string | null }>;
  created_at: string | null;
  updated_at: string | null;
};

type WorkflowDefinition = {
  config: Record<string, unknown>;
  prompt_template: string;
  path: string;
  version: string;
};

type SymphonyConfig = {
  workflowPath: string;
  tracker: {
    kind: "linear";
    endpoint: string;
    apiKey: string;
    projectSlug: string;
    activeStates: string[];
    terminalStates: string[];
  };
  polling: { intervalMs: number };
  workspace: { root: string };
  hooks: {
    afterCreate: string | null;
    beforeRun: string | null;
    afterRun: string | null;
    beforeRemove: string | null;
    timeoutMs: number;
  };
  agent: {
    maxConcurrentAgents: number;
    maxTurns: number;
    maxRetryBackoffMs: number;
    maxConcurrentAgentsByState: Map<string, number>;
  };
  codex: {
    command: string;
    approvalPolicy: unknown;
    threadSandbox: unknown;
    turnSandboxPolicy: unknown;
    turnTimeoutMs: number;
    readTimeoutMs: number;
    stallTimeoutMs: number;
  };
};

type RunningEntry = {
  issue: SymphonyIssue;
  worker: ChildProcessWithoutNullStreams | null;
  abort: AbortController;
  attempt: number | null;
  workspacePath: string | null;
  startedAt: number;
  lastCodexTimestamp: number | null;
  lastCodexEvent: string | null;
  lastCodexMessage: string | null;
  sessionId: string | null;
  threadId: string | null;
  turnId: string | null;
  codexInputTokens: number;
  codexOutputTokens: number;
  codexTotalTokens: number;
  lastReportedInputTokens: number;
  lastReportedOutputTokens: number;
  lastReportedTotalTokens: number;
  turnCount: number;
};

type RetryEntry = {
  issueId: string;
  identifier: string;
  attempt: number;
  dueAtMs: number;
  timer: NodeJS.Timeout;
  error: string | null;
};

type OrchestratorState = {
  running: Map<string, RunningEntry>;
  claimed: Set<string>;
  retryAttempts: Map<string, RetryEntry>;
  completed: Set<string>;
  codexTotals: { inputTokens: number; outputTokens: number; totalTokens: number; secondsRunning: number };
  codexRateLimits: unknown;
};

class SymphonyError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

const DEFAULT_ACTIVE_STATES = ["Todo", "In Progress"];
const DEFAULT_TERMINAL_STATES = ["Closed", "Cancelled", "Canceled", "Duplicate", "Done"];
const DEFAULT_PROMPT = "You are working on an issue from Linear.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readObject(root: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = root[key];
  return isRecord(value) ? value : {};
}

function readString(root: Record<string, unknown>, key: string, fallback = ""): string {
  const value = root[key];
  return typeof value === "string" ? value : fallback;
}

function readInt(root: Record<string, unknown>, key: string, fallback: number): number {
  const value = root[key];
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/u.test(value)) return Number(value);
  return fallback;
}

function readStringList(root: Record<string, unknown>, key: string, fallback: string[]): string[] {
  const value = root[key];
  return Array.isArray(value) && value.every((entry) => typeof entry === "string") ? value : fallback;
}

function normalizeState(state: string): string {
  return state.toLowerCase();
}

function stateSet(states: string[]) {
  return new Set(states.map(normalizeState));
}

function resolveEnvReference(value: string, env: NodeJS.ProcessEnv): string {
  if (!value.startsWith("$")) return value;
  const name = value.slice(1);
  return env[name] ?? "";
}

function expandPath(value: string, baseDir: string, env: NodeJS.ProcessEnv): string {
  let expanded = value.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/gu, (_, name: string) => env[name] ?? "");
  if (expanded === "~") expanded = homedir();
  if (expanded.startsWith(`~${sep}`)) expanded = join(homedir(), expanded.slice(2));
  return isAbsolute(expanded) ? resolve(expanded) : resolve(baseDir, expanded);
}

export async function loadWorkflow(workflowPath = resolve(process.cwd(), "WORKFLOW.md")): Promise<WorkflowDefinition> {
  let source: string;
  try {
    source = await readFile(workflowPath, "utf8");
  } catch (error) {
    throw new SymphonyError("missing_workflow_file", `Unable to read workflow file ${workflowPath}: ${(error as Error).message}`);
  }

  let config: Record<string, unknown> = {};
  let body = source;
  if (source.startsWith("---")) {
    const marker = source.indexOf("\n---", 3);
    if (marker === -1) {
      throw new SymphonyError("workflow_parse_error", "Workflow front matter starts with --- but has no closing --- marker.");
    }
    const yamlSource = source.slice(3, marker).trim();
    body = source.slice(marker + 4);
    try {
      const parsed = yamlSource ? yaml.load(yamlSource) : {};
      if (!isRecord(parsed)) {
        throw new SymphonyError("workflow_front_matter_not_a_map", "Workflow front matter must decode to a YAML map/object.");
      }
      config = parsed;
    } catch (error) {
      if (error instanceof SymphonyError) throw error;
      throw new SymphonyError("workflow_parse_error", `Unable to parse workflow front matter: ${(error as Error).message}`);
    }
  }

  return {
    config,
    prompt_template: body.trim(),
    path: resolve(workflowPath),
    version: createHash("sha256").update(source).digest("hex"),
  };
}

export function resolveSymphonyConfig(workflow: WorkflowDefinition, env: NodeJS.ProcessEnv = process.env): SymphonyConfig {
  const workflowDir = dirname(workflow.path);
  const tracker = readObject(workflow.config, "tracker");
  const polling = readObject(workflow.config, "polling");
  const workspace = readObject(workflow.config, "workspace");
  const hooks = readObject(workflow.config, "hooks");
  const agent = readObject(workflow.config, "agent");
  const codex = readObject(workflow.config, "codex");

  const trackerKind = readString(tracker, "kind");
  if (trackerKind !== "linear") {
    throw new SymphonyError("unsupported_tracker_kind", trackerKind ? `Unsupported tracker.kind ${trackerKind}.` : "tracker.kind is required.");
  }

  const apiKeyRaw = readString(tracker, "api_key", "$LINEAR_API_KEY");
  const apiKey = resolveEnvReference(apiKeyRaw, env);
  const projectSlug = readString(tracker, "project_slug");
  const command = readString(codex, "command", "codex app-server").trim();
  const hookTimeoutMs = readInt(hooks, "timeout_ms", 60000);
  const maxTurns = readInt(agent, "max_turns", 20);

  if (!apiKey) throw new SymphonyError("missing_tracker_api_key", "tracker.api_key is missing after environment resolution.");
  if (!projectSlug) throw new SymphonyError("missing_tracker_project_slug", "tracker.project_slug is required for Linear.");
  if (!command) throw new SymphonyError("missing_codex_command", "codex.command must be non-empty.");
  if (hookTimeoutMs <= 0) throw new SymphonyError("invalid_hook_timeout", "hooks.timeout_ms must be positive.");
  if (maxTurns <= 0) throw new SymphonyError("invalid_agent_max_turns", "agent.max_turns must be positive.");

  const byState = new Map<string, number>();
  const byStateRaw = agent.max_concurrent_agents_by_state;
  if (isRecord(byStateRaw)) {
    for (const [key, value] of Object.entries(byStateRaw)) {
      const numeric = typeof value === "number" ? value : typeof value === "string" && /^\d+$/u.test(value) ? Number(value) : 0;
      if (Number.isInteger(numeric) && numeric > 0) byState.set(normalizeState(key), numeric);
    }
  }

  return {
    workflowPath: workflow.path,
    tracker: {
      kind: "linear",
      endpoint: readString(tracker, "endpoint", "https://api.linear.app/graphql"),
      apiKey,
      projectSlug,
      activeStates: readStringList(tracker, "active_states", DEFAULT_ACTIVE_STATES),
      terminalStates: readStringList(tracker, "terminal_states", DEFAULT_TERMINAL_STATES),
    },
    polling: { intervalMs: Math.max(readInt(polling, "interval_ms", 30000), 1) },
    workspace: { root: expandPath(readString(workspace, "root", "/symphony_workspaces"), workflowDir, env) },
    hooks: {
      afterCreate: readString(hooks, "after_create") || null,
      beforeRun: readString(hooks, "before_run") || null,
      afterRun: readString(hooks, "after_run") || null,
      beforeRemove: readString(hooks, "before_remove") || null,
      timeoutMs: hookTimeoutMs,
    },
    agent: {
      maxConcurrentAgents: Math.max(readInt(agent, "max_concurrent_agents", 10), 1),
      maxTurns,
      maxRetryBackoffMs: Math.max(readInt(agent, "max_retry_backoff_ms", 300000), 1),
      maxConcurrentAgentsByState: byState,
    },
    codex: {
      command,
      approvalPolicy: codex.approval_policy,
      threadSandbox: codex.thread_sandbox,
      turnSandboxPolicy: codex.turn_sandbox_policy,
      turnTimeoutMs: Math.max(readInt(codex, "turn_timeout_ms", 3600000), 1),
      readTimeoutMs: Math.max(readInt(codex, "read_timeout_ms", 5000), 1),
      stallTimeoutMs: readInt(codex, "stall_timeout_ms", 300000),
    },
  };
}

export async function renderPrompt(template: string, issue: SymphonyIssue, attempt: number | null): Promise<string> {
  const engine = new Liquid({ strictVariables: true, strictFilters: true });
  const source = template.trim() || DEFAULT_PROMPT;
  try {
    return await engine.parseAndRender(source, { issue, attempt });
  } catch (error) {
    throw new SymphonyError("template_render_error", (error as Error).message);
  }
}

export function sanitizeWorkspaceKey(identifier: string): string {
  return identifier.replace(/[^A-Za-z0-9._-]/gu, "_");
}

function assertUnderRoot(root: string, child: string) {
  const normalizedRoot = resolve(root);
  const normalizedChild = resolve(child);
  if (normalizedChild !== normalizedRoot && !normalizedChild.startsWith(`${normalizedRoot}${sep}`)) {
    throw new SymphonyError("workspace_escape", `Workspace path ${normalizedChild} is outside root ${normalizedRoot}.`);
  }
}

async function runHook(name: string, script: string | null, cwd: string, timeoutMs: number, bestEffort: boolean) {
  if (!script) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await new Promise<void>((resolvePromise, reject) => {
      const child = spawn("sh", ["-lc", script], { cwd, signal: controller.signal });
      let stderr = "";
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk: string) => {
        stderr += chunk;
        stderr = stderr.slice(-4000);
      });
      child.on("error", reject);
      child.on("close", (code, signal) => {
        if (code === 0) resolvePromise();
        else reject(new Error(`${name} hook failed code=${code ?? "null"} signal=${signal ?? "null"} stderr=${stderr.trim()}`));
      });
    });
  } catch (error) {
    if (!bestEffort) throw error;
    log("warn", "hook failed ignored", { hook: name, error: (error as Error).message });
  } finally {
    clearTimeout(timer);
  }
}

export async function createWorkspace(config: SymphonyConfig, issue: SymphonyIssue) {
  const workspaceKey = sanitizeWorkspaceKey(issue.identifier);
  const workspacePath = resolve(config.workspace.root, workspaceKey);
  assertUnderRoot(config.workspace.root, workspacePath);
  await mkdir(config.workspace.root, { recursive: true });
  let createdNow = false;
  try {
    const current = await stat(workspacePath);
    if (!current.isDirectory()) throw new SymphonyError("workspace_not_directory", `${workspacePath} exists and is not a directory.`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await mkdir(workspacePath, { recursive: false });
    createdNow = true;
  }
  if (createdNow) await runHook("after_create", config.hooks.afterCreate, workspacePath, config.hooks.timeoutMs, false);
  return { path: workspacePath, workspace_key: workspaceKey, created_now: createdNow };
}

async function removeWorkspace(config: SymphonyConfig, identifier: string) {
  const workspacePath = resolve(config.workspace.root, sanitizeWorkspaceKey(identifier));
  assertUnderRoot(config.workspace.root, workspacePath);
  try {
    await access(workspacePath, fsConstants.F_OK);
  } catch {
    return;
  }
  await runHook("before_remove", config.hooks.beforeRemove, workspacePath, config.hooks.timeoutMs, true);
  await rm(workspacePath, { recursive: true, force: true });
}

function normalizeIssue(raw: Record<string, unknown>): SymphonyIssue {
  const labelsNode = isRecord(raw.labels) && Array.isArray(raw.labels.nodes) ? raw.labels.nodes : [];
  const relationsNode = isRecord(raw.inverseRelations) && Array.isArray(raw.inverseRelations.nodes) ? raw.inverseRelations.nodes : [];
  const blockedBy = relationsNode
    .filter((relation) => isRecord(relation) && relation.type === "blocks" && isRecord(relation.relatedIssue))
    .map((relation) => {
      const related = (relation as { relatedIssue: Record<string, unknown> }).relatedIssue;
      return {
        id: typeof related.id === "string" ? related.id : null,
        identifier: typeof related.identifier === "string" ? related.identifier : null,
        state: isRecord(related.state) && typeof related.state.name === "string" ? related.state.name : null,
      };
    });
  const priority = typeof raw.priority === "number" && Number.isInteger(raw.priority) ? raw.priority : null;
  return {
    id: String(raw.id ?? ""),
    identifier: String(raw.identifier ?? ""),
    title: String(raw.title ?? ""),
    description: typeof raw.description === "string" ? raw.description : null,
    priority,
    state: isRecord(raw.state) && typeof raw.state.name === "string" ? raw.state.name : String(raw.state ?? ""),
    branch_name: typeof raw.branchName === "string" ? raw.branchName : null,
    url: typeof raw.url === "string" ? raw.url : null,
    labels: labelsNode.flatMap((label) => isRecord(label) && typeof label.name === "string" ? [label.name.toLowerCase()] : []),
    blocked_by: blockedBy,
    created_at: typeof raw.createdAt === "string" ? raw.createdAt : null,
    updated_at: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
  };
}

class LinearClient {
  constructor(private config: SymphonyConfig) {}

  async fetchCandidateIssues() {
    return this.fetchIssues({
      filter: {
        project: { slugId: { eq: this.config.tracker.projectSlug } },
        state: { name: { in: this.config.tracker.activeStates } },
      },
    });
  }

  async fetchIssuesByStates(states: string[]) {
    if (states.length === 0) return [];
    return this.fetchIssues({
      filter: {
        project: { slugId: { eq: this.config.tracker.projectSlug } },
        state: { name: { in: states } },
      },
    });
  }

  async fetchIssueStatesByIds(issueIds: string[]) {
    if (issueIds.length === 0) return [];
    const data = await this.graphql(ISSUE_STATES_QUERY, { ids: issueIds });
    const nodes = isRecord(data) && isRecord(data.issues) && Array.isArray(data.issues.nodes) ? data.issues.nodes : null;
    if (!nodes) throw new SymphonyError("linear_unknown_payload", "Linear issue state response did not include issues.nodes.");
    return nodes.map((node) => normalizeIssue(node as Record<string, unknown>));
  }

  private async fetchIssues(variables: Record<string, unknown>) {
    const issues: SymphonyIssue[] = [];
    let after: string | null = null;
    do {
      const data = await this.graphql(CANDIDATE_ISSUES_QUERY, { ...variables, after, first: 50 });
      const connection = isRecord(data) && isRecord(data.issues) ? data.issues : null;
      if (!connection || !Array.isArray(connection.nodes) || !isRecord(connection.pageInfo)) {
        throw new SymphonyError("linear_unknown_payload", "Linear response did not include issues.nodes/pageInfo.");
      }
      issues.push(...connection.nodes.map((node) => normalizeIssue(node as Record<string, unknown>)));
      const hasNext = connection.pageInfo.hasNextPage === true;
      const endCursor = typeof connection.pageInfo.endCursor === "string" ? connection.pageInfo.endCursor : null;
      if (hasNext && !endCursor) throw new SymphonyError("linear_missing_end_cursor", "Linear response has next page without endCursor.");
      after = hasNext ? endCursor : null;
    } while (after);
    return issues;
  }

  private async graphql(query: string, variables: Record<string, unknown>) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(this.config.tracker.endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          authorization: this.config.tracker.apiKey,
        },
        body: JSON.stringify({ query, variables }),
      });
      if (!response.ok) throw new SymphonyError("linear_api_status", `Linear returned HTTP ${response.status}.`);
      const payload = await response.json() as { data?: unknown; errors?: unknown };
      if (payload.errors) throw new SymphonyError("linear_graphql_errors", "Linear returned GraphQL errors.");
      if (!isRecord(payload.data)) throw new SymphonyError("linear_unknown_payload", "Linear response did not include data object.");
      return payload.data;
    } catch (error) {
      if (error instanceof SymphonyError) throw error;
      throw new SymphonyError("linear_api_request", (error as Error).message);
    } finally {
      clearTimeout(timer);
    }
  }
}

const ISSUE_FIELDS = `
  id
  identifier
  title
  description
  priority
  branchName
  url
  createdAt
  updatedAt
  state { name }
  labels { nodes { name } }
  inverseRelations { nodes { type relatedIssue { id identifier state { name } } } }
`;

const CANDIDATE_ISSUES_QUERY = `query SymphonyCandidateIssues($filter: IssueFilter, $first: Int!, $after: String) {
  issues(filter: $filter, first: $first, after: $after) {
    nodes { ${ISSUE_FIELDS} }
    pageInfo { hasNextPage endCursor }
  }
}`;

const ISSUE_STATES_QUERY = `query SymphonyIssueStates($ids: [ID!]) {
  issues(filter: { id: { in: $ids } }) {
    nodes { ${ISSUE_FIELDS} }
  }
}`;

function log(level: "info" | "warn" | "error", message: string, fields: Record<string, unknown> = {}) {
  const pairs = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(" ");
  console.error(`level=${level} component=symphony message=${JSON.stringify(message)}${pairs ? ` ${pairs}` : ""}`);
}

function sortIssues(issues: SymphonyIssue[]) {
  return [...issues].sort((a, b) => {
    const priorityA = a.priority ?? Number.MAX_SAFE_INTEGER;
    const priorityB = b.priority ?? Number.MAX_SAFE_INTEGER;
    if (priorityA !== priorityB) return priorityA - priorityB;
    const createdA = a.created_at ? Date.parse(a.created_at) : Number.MAX_SAFE_INTEGER;
    const createdB = b.created_at ? Date.parse(b.created_at) : Number.MAX_SAFE_INTEGER;
    if (createdA !== createdB) return createdA - createdB;
    return a.identifier.localeCompare(b.identifier);
  });
}

function isEligible(issue: SymphonyIssue, config: SymphonyConfig, state: OrchestratorState) {
  if (!issue.id || !issue.identifier || !issue.title || !issue.state) return false;
  const active = stateSet(config.tracker.activeStates);
  const terminal = stateSet(config.tracker.terminalStates);
  const normalized = normalizeState(issue.state);
  if (!active.has(normalized) || terminal.has(normalized)) return false;
  if (state.running.has(issue.id) || state.claimed.has(issue.id)) return false;
  if (issue.state === "Todo" && issue.blocked_by.some((blocker) => !blocker.state || !terminal.has(normalizeState(blocker.state)))) return false;
  const byStateLimit = config.agent.maxConcurrentAgentsByState.get(normalized) ?? config.agent.maxConcurrentAgents;
  const runningInState = [...state.running.values()].filter((entry) => normalizeState(entry.issue.state) === normalized).length;
  return state.running.size < config.agent.maxConcurrentAgents && runningInState < byStateLimit;
}

async function runAgentAttempt(
  config: SymphonyConfig,
  workflow: WorkflowDefinition,
  tracker: LinearClient,
  issue: SymphonyIssue,
  attempt: number | null,
  entry: RunningEntry,
) {
  const workspace = await createWorkspace(config, issue);
  entry.workspacePath = workspace.path;
  await runHook("before_run", config.hooks.beforeRun, workspace.path, config.hooks.timeoutMs, false);
  try {
    let currentIssue = issue;
    for (let turn = 1; turn <= config.agent.maxTurns; turn += 1) {
      entry.turnCount = turn;
      const prompt = turn === 1
        ? await renderPrompt(workflow.prompt_template, currentIssue, attempt)
        : `Continue working on ${currentIssue.identifier}. Re-check the tracker state and move toward the workflow-defined handoff.`;
      await runCodexTurn(config, workspace.path, currentIssue, prompt, entry);
      const [refreshed] = await tracker.fetchIssueStatesByIds([currentIssue.id]);
      if (refreshed) currentIssue = refreshed;
      entry.issue = currentIssue;
      if (!stateSet(config.tracker.activeStates).has(normalizeState(currentIssue.state))) break;
    }
  } finally {
    await runHook("after_run", config.hooks.afterRun, workspace.path, config.hooks.timeoutMs, true);
  }
}

async function runCodexTurn(config: SymphonyConfig, cwd: string, issue: SymphonyIssue, prompt: string, entry: RunningEntry) {
  assertUnderRoot(config.workspace.root, cwd);
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn("bash", ["-lc", config.codex.command], { cwd });
    entry.worker = child;
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new SymphonyError("turn_timeout", `Codex turn timed out for ${issue.identifier}.`));
    }, config.codex.turnTimeoutMs);
    const startup = setTimeout(() => {
      if (!entry.lastCodexEvent) log("warn", "codex startup produced no protocol event yet", { issue_id: issue.id, issue_identifier: issue.identifier });
    }, config.codex.readTimeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      for (const line of chunk.split(/\r?\n/u).filter(Boolean)) {
        try {
          const event = JSON.parse(line) as Record<string, unknown>;
          updateCodexEvent(entry, event);
        } catch {
          updateCodexEvent(entry, { event: "other_message", message: line.slice(0, 500) });
        }
      }
    });
    child.stderr.on("data", (chunk: string) => {
      updateCodexEvent(entry, { event: "notification", message: chunk.trim().slice(0, 500) });
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      clearTimeout(startup);
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      clearTimeout(startup);
      entry.worker = null;
      if (code === 0) resolvePromise();
      else reject(new SymphonyError("turn_failed", `Codex exited code=${code ?? "null"} signal=${signal ?? "null"}.`));
    });
    child.stdin.end(`${prompt}\n`);
  });
}

function updateCodexEvent(entry: RunningEntry, event: Record<string, unknown>) {
  const eventName = typeof event.event === "string" ? event.event : typeof event.type === "string" ? event.type : "other_message";
  entry.lastCodexEvent = eventName;
  entry.lastCodexTimestamp = Date.now();
  entry.lastCodexMessage = typeof event.message === "string" ? event.message : JSON.stringify(event).slice(0, 500);
  if (typeof event.thread_id === "string") entry.threadId = event.thread_id;
  if (typeof event.turn_id === "string") entry.turnId = event.turn_id;
  if (entry.threadId && entry.turnId) entry.sessionId = `${entry.threadId}-${entry.turnId}`;
  const usage = isRecord(event.usage) ? event.usage : isRecord(event.total_token_usage) ? event.total_token_usage : null;
  if (usage) {
    const input = Number(usage.input_tokens ?? usage.inputTokens ?? 0);
    const output = Number(usage.output_tokens ?? usage.outputTokens ?? 0);
    const total = Number(usage.total_tokens ?? usage.totalTokens ?? input + output);
    if (Number.isFinite(input)) entry.codexInputTokens = input;
    if (Number.isFinite(output)) entry.codexOutputTokens = output;
    if (Number.isFinite(total)) entry.codexTotalTokens = total;
  }
}

export class SymphonyOrchestrator {
  private workflow: WorkflowDefinition | null = null;
  private config: SymphonyConfig | null = null;
  private tracker: LinearClient | null = null;
  private timer: NodeJS.Timeout | null = null;
  private lastWorkflowVersion: string | null = null;
  private stopped = false;
  readonly state: OrchestratorState = {
    running: new Map(),
    claimed: new Set(),
    retryAttempts: new Map(),
    completed: new Set(),
    codexTotals: { inputTokens: 0, outputTokens: 0, totalTokens: 0, secondsRunning: 0 },
    codexRateLimits: null,
  };

  constructor(private workflowPath: string) {}

  async start() {
    await this.reloadWorkflow(true);
    await this.startupTerminalCleanup();
    await this.tick();
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    for (const retry of this.state.retryAttempts.values()) clearTimeout(retry.timer);
    for (const [issueId, entry] of this.state.running) this.terminate(issueId, entry, false, "service stopping");
  }

  private async reloadWorkflow(strict: boolean) {
    try {
      const workflow = await loadWorkflow(this.workflowPath);
      if (workflow.version === this.lastWorkflowVersion && this.config) return;
      const config = resolveSymphonyConfig(workflow);
      this.workflow = workflow;
      this.config = config;
      this.tracker = new LinearClient(config);
      this.lastWorkflowVersion = workflow.version;
      log("info", "workflow loaded", { workflow_path: workflow.path, workspace_root: config.workspace.root });
    } catch (error) {
      log(strict ? "error" : "warn", "workflow reload failed", { error: (error as Error).message });
      if (strict) throw error;
    }
  }

  private scheduleNext() {
    if (this.stopped || !this.config) return;
    this.timer = setTimeout(() => void this.tick(), this.config.polling.intervalMs);
  }

  async tick() {
    if (this.stopped) return;
    await this.reloadWorkflow(false);
    if (!this.config || !this.workflow || !this.tracker) {
      this.scheduleNext();
      return;
    }
    await this.reconcile();
    let issues: SymphonyIssue[];
    try {
      issues = await this.tracker.fetchCandidateIssues();
    } catch (error) {
      log("error", "candidate fetch failed", { error: (error as Error).message });
      this.scheduleNext();
      return;
    }
    for (const issue of sortIssues(issues)) {
      if (isEligible(issue, this.config, this.state)) this.dispatch(issue, null);
    }
    this.scheduleNext();
  }

  private dispatch(issue: SymphonyIssue, attempt: number | null) {
    if (!this.config || !this.workflow || !this.tracker || this.state.claimed.has(issue.id)) return;
    const entry: RunningEntry = {
      issue,
      worker: null,
      abort: new AbortController(),
      attempt,
      workspacePath: null,
      startedAt: Date.now(),
      lastCodexTimestamp: null,
      lastCodexEvent: null,
      lastCodexMessage: null,
      sessionId: null,
      threadId: null,
      turnId: null,
      codexInputTokens: 0,
      codexOutputTokens: 0,
      codexTotalTokens: 0,
      lastReportedInputTokens: 0,
      lastReportedOutputTokens: 0,
      lastReportedTotalTokens: 0,
      turnCount: 0,
    };
    this.state.claimed.add(issue.id);
    this.state.running.set(issue.id, entry);
    const config = this.config;
    const workflow = this.workflow;
    const tracker = this.tracker;
    log("info", "dispatching issue", { issue_id: issue.id, issue_identifier: issue.identifier, attempt });
    void runAgentAttempt(config, workflow, tracker, issue, attempt, entry)
      .then(() => this.onWorkerExit(issue.id, "normal", null))
      .catch((error: Error) => this.onWorkerExit(issue.id, "abnormal", error));
  }

  private onWorkerExit(issueId: string, reason: "normal" | "abnormal", error: Error | null) {
    const entry = this.state.running.get(issueId);
    if (!entry || !this.config) return;
    this.state.running.delete(issueId);
    const seconds = (Date.now() - entry.startedAt) / 1000;
    this.state.codexTotals.secondsRunning += seconds;
    this.state.codexTotals.inputTokens += Math.max(entry.codexInputTokens - entry.lastReportedInputTokens, 0);
    this.state.codexTotals.outputTokens += Math.max(entry.codexOutputTokens - entry.lastReportedOutputTokens, 0);
    this.state.codexTotals.totalTokens += Math.max(entry.codexTotalTokens - entry.lastReportedTotalTokens, 0);
    if (reason === "normal") {
      this.state.completed.add(issueId);
      this.scheduleRetry(issueId, entry.issue.identifier, 1, null, 1000);
    } else {
      const nextAttempt = (entry.attempt ?? 0) + 1;
      const delayMs = Math.min(10000 * (2 ** (nextAttempt - 1)), this.config.agent.maxRetryBackoffMs);
      this.scheduleRetry(issueId, entry.issue.identifier, nextAttempt, error?.message ?? "worker failed", delayMs);
    }
  }

  private scheduleRetry(issueId: string, identifier: string, attempt: number, error: string | null, delayMs: number) {
    const existing = this.state.retryAttempts.get(issueId);
    if (existing) clearTimeout(existing.timer);
    const dueAtMs = Date.now() + delayMs;
    const timer = setTimeout(() => void this.onRetry(issueId), delayMs);
    this.state.retryAttempts.set(issueId, { issueId, identifier, attempt, dueAtMs, timer, error });
    log("info", "retry scheduled", { issue_id: issueId, issue_identifier: identifier, attempt, delay_ms: delayMs, error });
  }

  private async onRetry(issueId: string) {
    const retry = this.state.retryAttempts.get(issueId);
    if (!retry || !this.config || !this.tracker) return;
    this.state.retryAttempts.delete(issueId);
    let candidates: SymphonyIssue[];
    try {
      candidates = await this.tracker.fetchCandidateIssues();
    } catch {
      this.scheduleRetry(issueId, retry.identifier, retry.attempt + 1, "retry poll failed", this.config.agent.maxRetryBackoffMs);
      return;
    }
    this.state.claimed.delete(issueId);
    const issue = candidates.find((candidate) => candidate.id === issueId);
    if (!issue) return;
    if (isEligible(issue, this.config, this.state)) this.dispatch(issue, retry.attempt);
    else this.scheduleRetry(issueId, issue.identifier, retry.attempt + 1, "no available orchestrator slots", this.config.agent.maxRetryBackoffMs);
  }

  private async reconcile() {
    if (!this.config || !this.tracker) return;
    const now = Date.now();
    if (this.config.codex.stallTimeoutMs > 0) {
      for (const [issueId, entry] of this.state.running) {
        const last = entry.lastCodexTimestamp ?? entry.startedAt;
        if (now - last > this.config.codex.stallTimeoutMs) {
          entry.worker?.kill("SIGTERM");
          this.onWorkerExit(issueId, "abnormal", new SymphonyError("stalled", "agent session stalled"));
        }
      }
    }
    const runningIds = [...this.state.running.keys()];
    if (runningIds.length === 0) return;
    let refreshed: SymphonyIssue[];
    try {
      refreshed = await this.tracker.fetchIssueStatesByIds(runningIds);
    } catch (error) {
      log("warn", "state refresh failed", { error: (error as Error).message });
      return;
    }
    const active = stateSet(this.config.tracker.activeStates);
    const terminal = stateSet(this.config.tracker.terminalStates);
    for (const issue of refreshed) {
      const entry = this.state.running.get(issue.id);
      if (!entry) continue;
      const normalized = normalizeState(issue.state);
      if (terminal.has(normalized)) {
        this.terminate(issue.id, entry, true, "terminal tracker state");
      } else if (active.has(normalized)) {
        entry.issue = issue;
      } else {
        this.terminate(issue.id, entry, false, "non-active tracker state");
      }
    }
  }

  private terminate(issueId: string, entry: RunningEntry, cleanupWorkspace: boolean, reason: string) {
    entry.worker?.kill("SIGTERM");
    entry.abort.abort();
    this.state.running.delete(issueId);
    this.state.claimed.delete(issueId);
    log("info", "terminated issue", { issue_id: issueId, issue_identifier: entry.issue.identifier, reason, cleanup_workspace: cleanupWorkspace });
    if (cleanupWorkspace && this.config) void removeWorkspace(this.config, entry.issue.identifier);
  }

  private async startupTerminalCleanup() {
    if (!this.config || !this.tracker) return;
    try {
      const terminalIssues = await this.tracker.fetchIssuesByStates(this.config.tracker.terminalStates);
      for (const issue of terminalIssues) await removeWorkspace(this.config, issue.identifier);
    } catch (error) {
      log("warn", "startup terminal workspace cleanup failed", { error: (error as Error).message });
    }
  }
}

export async function runSymphonyCommand(args: string[]) {
  const workflowPath = resolve(args[0] ?? "WORKFLOW.md");
  const orchestrator = new SymphonyOrchestrator(workflowPath);
  process.on("SIGINT", () => {
    orchestrator.stop();
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    orchestrator.stop();
    process.exit(143);
  });
  await orchestrator.start();
  await new Promise(() => undefined);
}
