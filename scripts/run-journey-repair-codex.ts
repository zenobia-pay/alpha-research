import { spawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

type RepairJob = {
  id: string;
  runDir: string;
  journeyPath: string;
  briefingPath: string;
  suite: "prompt" | "tui";
};

type Args = {
  promptRoot: string;
  tuiRoot: string;
  outRoot: string;
  worktreeRoot: string;
  branch: string | null;
  ids: string[] | null;
  suites: Set<"prompt" | "tui">;
  model: string;
  execute: boolean;
  detach: boolean;
  isolated: boolean;
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (name: string, fallback: string) =>
    argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? fallback;
  const idsArg = argv.find((arg) => arg.startsWith("--journeys="))?.split("=")[1];
  const suiteArg = argv.find((arg) => arg.startsWith("--suite="))?.split("=")[1] ?? "all";
  const suites = new Set<"prompt" | "tui">();
  if (suiteArg === "all" || suiteArg === "prompt") suites.add("prompt");
  if (suiteArg === "all" || suiteArg === "tui") suites.add("tui");
  if (suites.size === 0) throw new Error(`Unknown --suite=${suiteArg}`);
  const outRoot = resolve(get("out", `.tmp/journey-repair-codex/${timestamp()}`));
  return {
    promptRoot: resolve(get("prompt-root", ".tmp/journey-runs-all")),
    tuiRoot: resolve(get("tui-root", ".tmp/tui-journey-runs")),
    outRoot,
    worktreeRoot: resolve(get("worktrees", `.tmp/journey-repair-worktrees/${timestamp()}`)),
    branch: argv.find((arg) => arg.startsWith("--branch="))?.split("=").slice(1).join("=") ?? null,
    ids: idsArg ? idsArg.split(",").map((id) => id.trim()).filter(Boolean) : null,
    suites,
    model: get("model", "gpt-5.4"),
    execute: argv.includes("--execute"),
    detach: argv.includes("--detach"),
    isolated: argv.includes("--isolated"),
  };
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function latestRunDir(root: string) {
  if (!existsSync(root)) return null;
  const dirs = readdirSync(root)
    .map((entry) => join(root, entry))
    .filter((entry) => statSync(entry).isDirectory())
    .sort();
  return dirs.length > 0 ? dirs[dirs.length - 1] : null;
}

function discoverJobs(root: string, suite: "prompt" | "tui") {
  if (!existsSync(root)) return [];
  const jobs: RepairJob[] = [];
  for (const id of readdirSync(root).sort()) {
    const journeyRoot = join(root, id);
    if (!statSync(journeyRoot).isDirectory()) continue;
    const runDir = latestRunDir(journeyRoot);
    if (!runDir) continue;
    const journeyPath = join(runDir, "journey.md");
    const briefingPath = join(runDir, "briefing.md");
    if (!existsSync(journeyPath) || !existsSync(briefingPath)) continue;
    jobs.push({ id, runDir, journeyPath, briefingPath, suite });
  }
  return jobs;
}

function listFiles(dir: string, subdir: string, suffix: string, limit = 20) {
  const root = join(dir, subdir);
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((entry) => entry.endsWith(suffix))
    .sort()
    .slice(0, limit)
    .map((entry) => join(root, entry));
}

function buildPrompt(job: RepairJob) {
  const journey = readFileSync(job.journeyPath, "utf8");
  const briefing = readFileSync(job.briefingPath, "utf8");
  const metadataPath = join(job.runDir, "metadata.json");
  const inputPath = join(job.runDir, "input.json");
  const terminalPath = join(job.runDir, "terminal.txt");
  const eventsPath = join(job.runDir, "events.jsonl");
  const snapshots = listFiles(job.runDir, "snapshots", ".txt");
  const screenshots = listFiles(job.runDir, "screenshots", ".svg");
  const artifacts = [
    metadataPath,
    inputPath,
    terminalPath,
    eventsPath,
    ...snapshots,
    ...screenshots,
  ].filter((path) => existsSync(path));

  return `We ran a canonical ${job.suite === "tui" ? "interactive TUI" : "prompt-mode"} journey for the \`research\` CLI and judged the UX/product behavior.

Your task: update the research CLI so that when this journey is run in the future, the result aligns with the expected behavior in the journey definition and fixes the surfaced issues in the briefing.

Do the implementation work directly in this checkout.

Hard requirements:
- Fix the underlying product/CLI behavior, not just the test harness or the judge.
- Do not preserve broken behavior for backwards compatibility.
- Do not degrade performance.
- Keep behavior aligned with the user-facing product goal of \`research\`: a dataset-backed research agent that helps users orient, choose/build/inspect datasets, start appropriately scoped research, understand run state, recover from blocked work, and retrieve useful artifacts.
- Prefer existing repo patterns and local abstractions.
- Add or update focused tests where practical.
- Run the relevant checks for the touched surface. At minimum, run typecheck or targeted CLI tests if the change touches CLI code.
- If multiple issues are listed, prioritize changes that make this journey pass without making adjacent journeys worse.
- Commit your changes on this shared journey repair branch when complete. Do not push.
- Leave the working tree clean before exiting so the next journey repair can start from your completed commit.

Important source files likely relevant:
- apps/cli/src/index.ts
- apps/cli/src/interactive.tsx
- apps/cli/src/agent.ts
- apps/cli/src/tool-registry.ts
- apps/cli/src/runs.ts
- apps/cli/src/run-watcher.ts
- docs/RESEARCH_JOURNEY_EVAL.md

Journey run directory:
${job.runDir}

Useful run artifacts:
${artifacts.map((path) => `- ${path}`).join("\n")}

Original journey definition:

${journey}

Outcome / judge briefing:

${briefing}

Please make the requested changes now so this journey aligns with expectations on the next run.`;
}

function safeBranchName(id: string, runName: string) {
  return `codex/journey-repair-${id.toLowerCase()}-${runName.toLowerCase()}`.replace(/[^a-z0-9/_-]/g, "-").slice(0, 120);
}

function safeSharedBranchName(runName: string) {
  return `codex/journey-repair-sequential-${runName.toLowerCase()}`.replace(/[^a-z0-9/_-]/g, "-").slice(0, 120);
}

function runChecked(command: string, args: string[], cwd: string) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout.trim();
}

function prepareSharedWorktree(args: Args, runName: string) {
  const branch = args.branch ?? safeSharedBranchName(runName);
  const worktreePath = join(args.worktreeRoot, "shared");
  mkdirSync(args.worktreeRoot, { recursive: true });
  if (!existsSync(worktreePath)) {
    runChecked("git", ["worktree", "add", "-b", branch, worktreePath, "HEAD"], process.cwd());
  }
  return { branch, worktreePath };
}

function prepareIsolatedWorktree(job: RepairJob, args: Args, runName: string) {
  const worktreePath = join(args.worktreeRoot, job.id);
  const branch = safeBranchName(job.id, runName);
  mkdirSync(args.worktreeRoot, { recursive: true });
  if (!existsSync(worktreePath)) {
    runChecked("git", ["worktree", "add", "-b", branch, worktreePath, "HEAD"], process.cwd());
  }
  return { branch, worktreePath };
}

async function launchJob(job: RepairJob, args: Args, runName: string, shared?: { branch: string; worktreePath: string }) {
  const jobOut = join(args.outRoot, job.id);
  mkdirSync(jobOut, { recursive: true });
  const prompt = buildPrompt(job);
  const promptPath = join(jobOut, "prompt.md");
  const finalPath = join(jobOut, "final.md");
  const logPath = join(jobOut, "codex.log");
  const commandPath = join(jobOut, "command.json");
  writeFileSync(promptPath, prompt);

  const { branch, worktreePath } = shared ?? prepareIsolatedWorktree(job, args, runName);

  const command = [
    "codex",
    "exec",
    "--dangerously-bypass-approvals-and-sandbox",
    "-m",
    args.model,
    "-C",
    worktreePath,
    "-o",
    finalPath,
    "-",
  ];

  writeFileSync(commandPath, JSON.stringify({
    id: job.id,
    suite: job.suite,
    sourceRunDir: job.runDir,
    worktreePath,
    branch,
    promptPath,
    finalPath,
    logPath,
    command,
  }, null, 2));

  if (!args.execute) {
    console.log(`Prepared ${job.id}: ${promptPath}`);
    return;
  }

  if (!args.isolated && args.detach) {
    throw new Error("--detach cannot be used with the default sequential shared-branch mode. Use --isolated to start detached per-journey jobs.");
  }

  const out = openSync(logPath, "a");
  const input = openSync(promptPath, "r");
  const child = spawn(command[0], command.slice(1), {
    cwd: process.cwd(),
    detached: args.detach,
    stdio: [input, out, out],
  });
  writeFileSync(join(jobOut, "pid.txt"), `${child.pid}\n`);
  console.log(`${args.detach ? "Started" : "Running"} ${job.id}: pid=${child.pid} branch=${branch}`);
  if (args.detach) {
    child.unref();
    closeSync(input);
    closeSync(out);
    return;
  }
  await new Promise<void>((resolveProcess) => {
    child.on("exit", (code, signal) => {
      closeSync(input);
      closeSync(out);
      writeFileSync(join(jobOut, "exit.json"), JSON.stringify({ code, signal }, null, 2));
      console.log(`Finished ${job.id}: code=${code} signal=${signal ?? ""}`);
      resolveProcess();
    });
  });
  const exit = JSON.parse(readFileSync(join(jobOut, "exit.json"), "utf8")) as { code: number | null; signal: string | null };
  if (exit.code !== 0) {
    throw new Error(`Repair job ${job.id} failed with code=${exit.code} signal=${exit.signal ?? ""}. Stopping before the next journey.`);
  }
  if (!args.isolated) {
    const status = runChecked("git", ["status", "--porcelain"], worktreePath);
    writeFileSync(join(jobOut, "git-status.txt"), status ? `${status}\n` : "");
    if (status.trim().length > 0) {
      throw new Error(`Repair job ${job.id} left the shared worktree dirty. Stopping before the next journey.\n${status}`);
    }
  }
}

async function main() {
  const args = parseArgs();
  if (!args.isolated && args.detach) {
    throw new Error("--detach cannot be used with the default sequential shared-branch mode. Use --isolated to start detached per-journey jobs.");
  }
  const runName = basename(args.outRoot);
  mkdirSync(args.outRoot, { recursive: true });
  const jobs = [
    ...(args.suites.has("prompt") ? discoverJobs(args.promptRoot, "prompt") : []),
    ...(args.suites.has("tui") ? discoverJobs(args.tuiRoot, "tui") : []),
  ].filter((job) => !args.ids || args.ids.includes(job.id));
  if (jobs.length === 0) throw new Error("No journey runs found.");
  writeFileSync(join(args.outRoot, "manifest.json"), JSON.stringify({
    createdAt: new Date().toISOString(),
    promptRoot: args.promptRoot,
    tuiRoot: args.tuiRoot,
    worktreeRoot: args.worktreeRoot,
    mode: args.isolated ? "isolated" : "sequential-shared-branch",
    branch: args.isolated ? null : args.branch ?? safeSharedBranchName(runName),
    model: args.model,
    execute: args.execute,
    detach: args.detach,
    jobs: jobs.map((job) => ({
      id: job.id,
      suite: job.suite,
      runDir: job.runDir,
      journeyPath: job.journeyPath,
      briefingPath: job.briefingPath,
      outDir: join(args.outRoot, job.id),
      worktree: args.isolated ? join(args.worktreeRoot, job.id) : join(args.worktreeRoot, "shared"),
    })),
  }, null, 2));
  const shared = args.isolated ? undefined : prepareSharedWorktree(args, runName);
  for (const job of jobs) {
    await launchJob(job, args, runName, shared);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
