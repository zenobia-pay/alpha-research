import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const ROOT = resolve(import.meta.dirname, "..");
const WORKFLOW_PATH = resolve(ROOT, "WORKFLOW.md");
const DEFAULT_SYMPHONY_DIR = resolve(ROOT, ".tmp", "openai-symphony");
const SYMPHONY_REPO = "https://github.com/openai/symphony.git";
const LINEAR_ENDPOINT = "https://api.linear.app/graphql";
const LOCAL_ENV_PATH = resolve(ROOT, ".env.local");

type CommandResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
  status: number | null;
};

async function loadLocalEnv() {
  if (!existsSync(LOCAL_ENV_PATH)) return;
  const source = await readFile(LOCAL_ENV_PATH, "utf8");
  for (const line of source.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;
    const key = trimmed.slice(0, equalsIndex).trim();
    const rawValue = trimmed.slice(equalsIndex + 1).trim();
    if (!key || process.env[key]) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/gu, "");
  }
}

function run(command: string, args: string[], cwd = ROOT, env = process.env): CommandResult {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status,
  };
}

function printUsage() {
  console.log([
    "Usage:",
    "  npm run symphony:doctor",
    "  npm run symphony:bootstrap",
    "  npm run symphony:seed -- --title \"Small test issue\"",
    "  npm run symphony:start",
    "  npm run symphony:start -- --seed --title \"Small test issue\"",
    "",
    "Environment:",
    "  LINEAR_API_KEY              Required. Linear API key for polling and seed issue creation. May be set in .env.local.",
    "  ALPHA_RESEARCH_REPO_URL     Optional. Repo URL cloned into issue workspaces.",
    "  SYMPHONY_DIR                Optional. Upstream Symphony checkout path. Defaults to .tmp/openai-symphony.",
  ].join("\n"));
}

function parseArgs(argv: string[]) {
  const [command = "start", ...rest] = argv;
  const flags = new Map<string, string | boolean>();
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = rest[index + 1];
    if (next && !next.startsWith("--")) {
      flags.set(key, next);
      index += 1;
    } else {
      flags.set(key, true);
    }
  }
  return { command, flags };
}

function requireTool(name: string) {
  const result = run("bash", ["-lc", `command -v ${name}`]);
  if (!result.ok) {
    throw new Error(`Missing required tool: ${name}`);
  }
  return result.stdout.trim();
}

function ensureTool(name: string, brewPackage = name) {
  try {
    return requireTool(name);
  } catch (error) {
    const brew = run("bash", ["-lc", "command -v brew"]);
    if (!brew.ok) throw error;
    console.log(`Installing ${brewPackage} with Homebrew because ${name} was not found`);
    inherit("brew", ["install", brewPackage], ROOT);
    return requireTool(name);
  }
}

async function readWorkflowProjectSlug() {
  const workflow = await readFile(WORKFLOW_PATH, "utf8");
  const match = workflow.match(/^\s*project_slug:\s*["']?([^"'\n]+)["']?\s*$/mu);
  if (!match) throw new Error(`Unable to find tracker.project_slug in ${WORKFLOW_PATH}`);
  return match[1].trim();
}

async function doctor() {
  const checks: Array<[string, () => string]> = [
    ["WORKFLOW.md", () => {
      if (!existsSync(WORKFLOW_PATH)) throw new Error(`Missing ${WORKFLOW_PATH}`);
      return WORKFLOW_PATH;
    }],
    ["LINEAR_API_KEY", () => {
      if (!process.env.LINEAR_API_KEY) throw new Error("LINEAR_API_KEY is not set");
      return "set";
    }],
    ["git", () => requireTool("git")],
    ["npm", () => requireTool("npm")],
    ["codex", () => requireTool("codex")],
    ["mise", () => {
      try {
        return requireTool("mise");
      } catch (error) {
        const brew = run("bash", ["-lc", "command -v brew"]);
        if (brew.ok) return "missing; will install automatically with Homebrew during bootstrap/start";
        throw error;
      }
    }],
  ];

  let failed = false;
  for (const [label, check] of checks) {
    try {
      console.log(`ok ${label}: ${check()}`);
    } catch (error) {
      failed = true;
      console.error(`fail ${label}: ${(error as Error).message}`);
    }
  }

  const slug = await readWorkflowProjectSlug().catch((error: Error) => {
    failed = true;
    console.error(`fail workflow project slug: ${error.message}`);
    return "";
  });
  if (slug) console.log(`ok Linear project slug: ${slug}`);

  if (process.env.LINEAR_API_KEY && slug) {
    try {
      const context = await linearContext(slug);
      console.log(`ok Linear project: ${context.project.name} (${context.project.url})`);
      console.log(`ok Linear team: ${context.team.name}`);
      console.log(`ok Linear Todo state: ${context.todoState.name}`);
    } catch (error) {
      failed = true;
      console.error(`fail Linear API: ${(error as Error).message}`);
    }
  }

  if (failed) process.exitCode = 1;
}

async function bootstrap() {
  requireTool("git");
  ensureTool("mise");
  requireTool("npm");

  const symphonyDir = resolve(process.env.SYMPHONY_DIR ?? DEFAULT_SYMPHONY_DIR);
  await mkdir(dirname(symphonyDir), { recursive: true });
  if (!existsSync(symphonyDir)) {
    console.log(`Cloning ${SYMPHONY_REPO} into ${symphonyDir}`);
    inherit("git", ["clone", SYMPHONY_REPO, symphonyDir], ROOT);
  } else {
    console.log(`Updating ${symphonyDir}`);
    inherit("git", ["pull", "--ff-only"], symphonyDir);
  }

  const elixirDir = resolve(symphonyDir, "elixir");
  inherit("mise", ["trust"], elixirDir);
  inherit("mise", ["install"], elixirDir);
  inherit("mise", ["exec", "--", "mix", "setup"], elixirDir);
  inherit("mise", ["exec", "--", "mix", "build"], elixirDir);

  const binary = resolve(elixirDir, "bin", "symphony");
  if (!existsSync(binary)) {
    throw new Error(`Expected Symphony binary at ${binary}`);
  }
  console.log(`Symphony is ready: ${binary}`);
}

function inherit(command: string, args: string[], cwd: string, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

async function linearGraphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) throw new Error("LINEAR_API_KEY is not set");
  const response = await fetch(LINEAR_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });
  const payload = await response.json() as { data?: T; errors?: Array<{ message: string }> };
  if (!response.ok) throw new Error(`Linear HTTP ${response.status}: ${JSON.stringify(payload)}`);
  if (payload.errors?.length) throw new Error(`Linear GraphQL errors: ${payload.errors.map((error) => error.message).join("; ")}`);
  if (!payload.data) throw new Error("Linear response did not include data");
  return payload.data;
}

async function linearContext(projectSlug: string) {
  const data = await linearGraphql<{
    projects: {
      nodes: Array<{
        id: string;
        name: string;
        url: string;
        teams: { nodes: Array<{ id: string; name: string; key: string }> };
      }>;
    };
  }>(`query SymphonyProject($projectSlug: String!) {
    projects(filter: { slugId: { eq: $projectSlug } }, first: 1) {
      nodes {
        id
        name
        url
        teams { nodes { id name key } }
      }
    }
  }`, { projectSlug });

  const project = data.projects.nodes[0];
  if (!project) throw new Error(`Linear project not found for slug ${projectSlug}`);
  const team = project.teams.nodes[0];
  if (!team) throw new Error(`Linear project ${project.name} has no team`);

  const states = await linearGraphql<{
    workflowStates: { nodes: Array<{ id: string; name: string; type: string }> };
  }>(`query SymphonyStates($teamId: ID!) {
    workflowStates(filter: { team: { id: { eq: $teamId } } }, first: 100) {
      nodes { id name type }
    }
  }`, { teamId: team.id });

  const todoState = states.workflowStates.nodes.find((state) => state.name === "Todo");
  if (!todoState) throw new Error(`Todo state not found for Linear team ${team.name}`);
  return { project, team, todoState };
}

async function seedIssue(flags: Map<string, string | boolean>) {
  const projectSlug = await readWorkflowProjectSlug();
  const context = await linearContext(projectSlug);
  const titleFlag = flags.get("title");
  const title = typeof titleFlag === "string" ? titleFlag : "Symphony smoke test: update docs";
  const descriptionFlag = flags.get("description");
  const description = typeof descriptionFlag === "string"
    ? descriptionFlag
    : [
      "This is a small smoke issue created by `npm run symphony:seed`.",
      "",
      "Acceptance criteria:",
      "- Make a tiny documentation-only change.",
      "- Run `npm run docs:check`.",
      "- Commit, push, open/update a PR, and move this issue to In Review.",
    ].join("\n");

  const result = await linearGraphql<{
    issueCreate: {
      success: boolean;
      issue: { identifier: string; title: string; url: string };
    };
  }>(`mutation SymphonyCreateIssue($input: IssueCreateInput!) {
    issueCreate(input: $input) {
      success
      issue { identifier title url }
    }
  }`, {
    input: {
      teamId: context.team.id,
      projectId: context.project.id,
      stateId: context.todoState.id,
      title,
      description,
      priority: 3,
    },
  });

  if (!result.issueCreate.success) throw new Error("Linear issueCreate returned success=false");
  console.log(`Created ${result.issueCreate.issue.identifier}: ${result.issueCreate.issue.url}`);
}

async function start(flags: Map<string, string | boolean>) {
  await doctor();
  if (process.exitCode) throw new Error("Doctor failed; fix prerequisites before starting Symphony");
  await bootstrap();
  if (flags.has("seed")) await seedIssue(flags);

  const symphonyDir = resolve(process.env.SYMPHONY_DIR ?? DEFAULT_SYMPHONY_DIR);
  const binary = resolve(symphonyDir, "elixir", "bin", "symphony");
  const workspaceRoot = resolve(homedir(), "code", "alpha-research-workspaces");
  await mkdir(workspaceRoot, { recursive: true });
  console.log(`Starting Symphony with ${WORKFLOW_PATH}`);
  console.log(`Workspaces: ${workspaceRoot}`);

  const child = spawn("mise", [
    "exec",
    "--",
    binary,
    WORKFLOW_PATH,
    "--i-understand-that-this-will-be-running-without-the-usual-guardrails",
  ], {
    cwd: resolve(symphonyDir, "elixir"),
    env: process.env,
    stdio: "inherit",
  });
  await new Promise<void>((resolvePromise, reject) => {
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`Symphony exited code=${code ?? "null"} signal=${signal ?? "null"}`));
    });
  });
}

async function main() {
  await loadLocalEnv();
  const { command, flags } = parseArgs(process.argv.slice(2));
  if (command === "help" || command === "--help") {
    printUsage();
    return;
  }
  if (command === "doctor") {
    await doctor();
    return;
  }
  if (command === "bootstrap") {
    await bootstrap();
    return;
  }
  if (command === "seed") {
    await seedIssue(flags);
    return;
  }
  if (command === "start") {
    await start(flags);
    return;
  }
  printUsage();
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
