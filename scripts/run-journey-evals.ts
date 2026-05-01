import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

type Journey = {
  id: string;
  title: string;
  prompt: string;
  intention: string;
  correctOutcome: string;
  judgeFor: string;
  setup?: string;
};

const JOURNEYS: Journey[] = [
  {
    id: "J01",
    title: "Product Orientation",
    prompt: "What can you help me do?",
    intention: "The user has opened `research` without understanding the product.",
    correctOutcome: "`research` explains itself as a dataset-backed research agent in plain language. It names concrete actions: create a dataset from a file, list datasets, inspect or brief a dataset, design an experiment, run analysis, and retrieve artifacts. It should not dump internal architecture.",
    judgeFor: "Did the screen answer in user language, show 3-5 useful next actions, avoid overwhelming technical detail, and avoid requiring terms like remote run, manifest, or mounted dataset?",
  },
  {
    id: "J02",
    title: "Dataset Inventory",
    prompt: "What datasets do I have?",
    intention: "The user wants to orient around available data before choosing work.",
    correctOutcome: "`research` lists datasets with human names, ids, status, and short descriptions when available. It distinguishes ready, draft, building, local, and remote datasets where relevant. It suggests a natural next step like describing or analyzing one dataset.",
    judgeFor: "Was the list scannable, did each dataset have enough context to choose from, did it over-index on ids, and was local/remote readiness clear?",
  },
  {
    id: "J03",
    title: "Dataset Selection From Topic",
    prompt: "I want to study housing affordability. Which dataset should I use?",
    intention: "The user has a topic but not a dataset id.",
    correctOutcome: "`research` inspects or lists datasets, identifies likely relevant datasets, explains why, and asks for confirmation if multiple choices are plausible. It should not launch expensive work unless there is one obvious low-cost next step.",
    judgeFor: "Did it use dataset metadata instead of guessing, explain tradeoffs, ask a focused follow-up only if needed, and avoid making the user know exact dataset ids?",
  },
  {
    id: "J04",
    title: "Dataset Briefing",
    prompt: "Describe the econ dataset for me.",
    intention: "The user wants a briefing before trusting or analyzing a dataset.",
    correctOutcome: "`research` starts or returns a dataset briefing scoped to inventory and documentation. It requests or shows artifacts like `Dataset Briefing` and `Dataset Profile`, with fields, measures, time coverage, source coverage, row counts, and limitations. It should not drift into open-ended analysis.",
    judgeFor: "Did it stay in briefing mode, make async status clear, help the user understand dataset fitness, and make artifacts or links prominent?",
  },
  {
    id: "J05",
    title: "Field Meaning And Research Fit",
    prompt: "In the tweets dataset, what does quote_tweet_count mean and can I use it to define virality?",
    intention: "The user understands the dataset somewhat but is unsure about one metric and its research meaning.",
    correctOutcome: "`research` inspects metadata if needed, explains the field in context, says whether it is suitable as a proxy, and states limitations. It should not start an experiment.",
    judgeFor: "Did it answer the concept question before proposing work, distinguish field definition from experiment design, offer a concrete next step, and surface uncertainty if metadata is insufficient?",
  },
  {
    id: "J06",
    title: "File-To-Dataset Confusion",
    prompt: "I have a CSV of customer support tickets on my desktop. How do I turn it into something I can research here?",
    intention: "The user wants onboarding from raw file to usable dataset but has not provided a path or schema.",
    correctOutcome: "`research` asks for the absolute file path and a short description of the data. It briefly explains the next steps: infer schema, choose dataset name/id, normalize, and deploy. It should not pretend it can ingest without the file path.",
    judgeFor: "Did it ask for the minimum missing information, make the path requirement clear, avoid a long setup tutorial, and explain the next step in user terms?",
  },
  {
    id: "J07",
    title: "Create Dataset From File",
    prompt: "Create a dataset from /Users/me/Downloads/enriched_tweets.parquet. It contains tweets, authors, timestamps, text, and engagement counts. Name it Enriched Tweets and deploy it.",
    intention: "The user gives enough concrete information to start dataset creation.",
    correctOutcome: "`research` proceeds without unnecessary clarification. It confirms inferred id/name if useful, starts creation/upload/deploy work, and displays dataset id, run or deploy status, and the next useful action.",
    judgeFor: "Did it avoid questions already answered, clearly show progress, expose errors with recovery steps, and distinguish dataset creation from deployment?",
  },
  {
    id: "J08",
    title: "Vague Viral Tweets Experiment",
    prompt: "What’s up with tweets? Can you run an experiment for me on what types of tweets go viral?",
    intention: "The user wants an experiment but has not defined outcome, population, sample size, labeling approach, or outputs.",
    correctOutcome: "`research` should not start expensive work. It should inspect the relevant dataset, turn the vague idea into a concrete proposed experiment, define virality, propose labels and outputs, and ask for approval.",
    judgeFor: "Did it stop before launching a run, convert ambiguity into a precise plan, include falsifiable choices like metric/threshold/sample size/labels/charts, and ask a clear confirmation question?",
  },
  {
    id: "J09",
    title: "Specific Viral Tweets Experiment",
    prompt: "Using enriched-tweets, define viral tweets as the top 0.1% by quote_tweet_count. Randomly sample 100 viral tweets, label each for hook_type, emotional_tone, and controversy_level using strict JSON, then produce a bar chart and 10 representative examples.",
    intention: "The user supplies dataset, metric, threshold, sample size, labeling fields, and outputs.",
    correctOutcome: "`research` kicks off the run. It requires mounted dataset grounding, starts analysis/labeling work, returns run id/status/artifact expectations, and only asks a question if the dataset or fields are missing.",
    judgeFor: "Did it start rather than over-clarify, preserve the exact design, show run id and expected artifacts, and warn if fields were unavailable?",
  },
  {
    id: "J10",
    title: "Vague Housing Market Question",
    prompt: "Can you look into whether the housing market is in trouble?",
    intention: "The user has a broad topic and vague criterion.",
    correctOutcome: "`research` asks for clarification or proposes a concrete study design before running. It may suggest definitions like affordability stress, price/rent divergence, mortgage delinquency, inventory, region, and time period. It should not immediately start a broad public-data build.",
    judgeFor: "Did it recognize underspecification, offer useful operationalizations, ask for the smallest decision needed to proceed, and avoid a runaway expensive task?",
  },
  {
    id: "J11",
    title: "Specific Housing Dataset Build",
    prompt: "Make me a county-month economics dataset for testing a housing-cycle hypothesis from 2015 to 2025. Include FRED rates, Census population/income, Zillow home values and rents, BLS employment/unemployment/CPI, FHFA HPI, and NBER recession indicators. Validate source URLs, row counts, missingness, join keys, temporal coverage, and produce a data dictionary and manifest.",
    intention: "The user specifies scope, grain, time range, sources, validation, and artifacts.",
    correctOutcome: "`research` checks existing datasets, then creates a research environment/build run with the specified acquisition and validation plan. It returns dataset id, run id, and expected artifacts.",
    judgeFor: "Did it proceed without broad follow-ups, preserve source and validation requirements, show a concise reviewable plan, and make async status and artifact expectations clear?",
  },
  {
    id: "J12",
    title: "Vague Analysis On Known Dataset",
    prompt: "Analyze the econ dataset and tell me what’s interesting.",
    intention: "The user selected a dataset but not a research question.",
    correctOutcome: "`research` should not launch a broad analysis blindly. It should offer a dataset briefing plus suggested research directions, or ask which outcome/domain matters. If it proposes exploratory profiling, it should make scope and cost clear.",
    judgeFor: "Did it avoid pretending \"interesting\" is precise, offer useful research angles, ask a focused question, and keep the user in control of expensive work?",
  },
  {
    id: "J13",
    title: "Specific Analysis On Known Dataset",
    prompt: "Using the econ dataset, compare county-level unemployment changes against home value growth from 2019 through 2024. Group by county and year, create a correlation table, a scatter plot, and a short markdown summary with caveats.",
    intention: "The user supplies dataset, variables, time window, grouping, outputs, and interpretation format.",
    correctOutcome: "`research` starts the analysis run, or first verifies field names if necessary. It returns run id/status and expected table, chart, and summary artifacts.",
    judgeFor: "Did it ask only field-resolution questions if needed, start the run when enough information existed, keep the user oriented during async work, and make expected artifacts clear?",
  },
  {
    id: "J14",
    title: "Return To Last Run",
    prompt: "Show me the results from my last run.",
    intention: "The user does not remember the run id and wants continuity.",
    correctOutcome: "`research` uses tracked run state, identifies the latest relevant run, reports status, and retrieves results/artifacts if complete. If multiple candidates exist, it shows a small choice list.",
    judgeFor: "Did the user need to remember a run id, did it show which run was selected, were artifacts visible, and did it handle running/failed/completed states differently?",
  },
  {
    id: "J15",
    title: "Stuck Run Confusion",
    prompt: "My last run seems stuck. What’s happening?",
    intention: "The user is confused by async status and wants diagnosis, not raw logs.",
    correctOutcome: "`research` inspects active/tracked runs, shows current status/events, explains whether it is queued, running, reconciling, failed, or complete, and provides a next action: wait, debug, cancel, retry, or inspect artifacts.",
    judgeFor: "Did it explain state in plain language, include enough evidence without dumping JSON, offer an actionable next step, and avoid falsely declaring failure when state is uncertain?",
  },
  {
    id: "J16",
    title: "Busy Dataset Conflict",
    prompt: "Run a new analysis on enriched-tweets.",
    setup: "The dataset already has an active blocking run.",
    intention: "The user wants work done but does not know the dataset is locked.",
    correctOutcome: "`research` reports the conflict, identifies the blocking run, shows status/link, and suggests waiting, inspecting, or cancelling if appropriate. It should not start duplicate competing work.",
    judgeFor: "Was the conflict obvious, did it identify the blocking run, did it explain why no new run started, and was the next action clear?",
  },
];

const WIDTH = 120;
const HEIGHT = 36;
const SNAPSHOT_MS = Number(process.env.JOURNEY_SNAPSHOT_MS ?? 5000);
const TIMEOUT_MS = Number(process.env.JOURNEY_TIMEOUT_MS ?? 180000);
const JUDGE_TIMEOUT_MS = Number(process.env.JOURNEY_JUDGE_TIMEOUT_MS ?? 240000);

function parseArgs() {
  const args = process.argv.slice(2);
  const idsArg = args.find((arg) => arg.startsWith("--journeys="))?.split("=")[1];
  const outArg = args.find((arg) => arg.startsWith("--out="))?.split("=")[1];
  const judgeOnly = args.includes("--judge-only");
  const noJudge = args.includes("--no-judge");
  const noRun = args.includes("--no-run");
  return {
    ids: idsArg ? idsArg.split(",").map((id) => id.trim()).filter(Boolean) : JOURNEYS.map((j) => j.id),
    outRoot: resolve(outArg ?? ".tmp/journey-runs"),
    judgeOnly,
    noJudge,
    noRun,
  };
}

function stripAnsi(input: string) {
  return input
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\u001b\][^\u0007]*(\u0007|\u001b\\)/g, "")
    .replace(/\r/g, "\n");
}

function screenText(log: string) {
  const lines = stripAnsi(log).split("\n").flatMap((line) => {
    if (line.length <= WIDTH) return [line];
    const chunks: string[] = [];
    for (let i = 0; i < line.length; i += WIDTH) chunks.push(line.slice(i, i + WIDTH));
    return chunks;
  });
  return lines.slice(-HEIGHT).map((line) => line.padEnd(WIDTH, " ")).join("\n");
}

function escapeXml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function writeSvgScreenshot(text: string, svgPath: string) {
  const charWidth = 8.4;
  const lineHeight = 18;
  const padding = 16;
  const width = Math.ceil(WIDTH * charWidth + padding * 2);
  const height = HEIGHT * lineHeight + padding * 2;
  const lines = text.split("\n");
  const body = lines.map((line, index) => {
    const y = padding + 14 + index * lineHeight;
    return `<text x="${padding}" y="${y}">${escapeXml(line)}</text>`;
  }).join("\n");
  await writeFile(svgPath, [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="100%" height="100%" fill="#101317"/>`,
    `<g font-family="SFMono-Regular, Menlo, Consolas, monospace" font-size="13" fill="#f3f5f7" xml:space="preserve">`,
    body,
    `</g>`,
    `</svg>`,
  ].join("\n"));
}

function markdownForJourney(journey: Journey) {
  return [
    `# ${journey.id}: ${journey.title}`,
    "",
    "## Prompt",
    "",
    "```text",
    journey.prompt,
    "```",
    "",
    ...(journey.setup ? ["## Setup", "", journey.setup, ""] : []),
    "## Intention",
    "",
    journey.intention,
    "",
    "## Correct Outcome",
    "",
    journey.correctOutcome,
    "",
    "## Judge For",
    "",
    journey.judgeFor,
    "",
  ].join("\n");
}

async function runJourney(journey: Journey, outRoot: string) {
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
  const outDir = join(outRoot, journey.id, timestamp);
  const screenshotsDir = join(outDir, "screenshots");
  const snapshotsDir = join(outDir, "snapshots");
  await mkdir(screenshotsDir, { recursive: true });
  await mkdir(snapshotsDir, { recursive: true });

  await writeFile(join(outDir, "journey.md"), markdownForJourney(journey));
  await writeFile(join(outDir, "input.json"), JSON.stringify({
    journeyId: journey.id,
    prompt: journey.prompt,
    command: ["node", "apps/cli/dist/index.js", "--prompt", journey.prompt],
    timeoutMs: TIMEOUT_MS,
    snapshotMs: SNAPSHOT_MS,
  }, null, 2));

  let log = "";
  const events: string[] = [];
  const startedAt = Date.now();
  let snapshotIndex = 0;

  const takeSnapshot = async (label: string) => {
    const text = screenText(log);
    const base = `${String(snapshotIndex++).padStart(4, "0")}-${label}`;
    const txtPath = join(snapshotsDir, `${base}.txt`);
    const svgPath = join(screenshotsDir, `${base}.svg`);
    await writeFile(txtPath, text);
    await writeSvgScreenshot(text, svgPath);
    events.push(JSON.stringify({ atMs: Date.now() - startedAt, type: "snapshot", label, textPath: txtPath, screenshotPath: svgPath }));
  };

  await takeSnapshot("start");

  const child = spawn("node", ["apps/cli/dist/index.js", "--prompt", journey.prompt], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      COLUMNS: String(WIDTH),
      LINES: String(HEIGHT),
      FORCE_COLOR: "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    log += chunk.toString();
    events.push(JSON.stringify({ atMs: Date.now() - startedAt, type: "stdout", bytes: chunk.length }));
  });
  child.stderr.on("data", (chunk) => {
    log += chunk.toString();
    events.push(JSON.stringify({ atMs: Date.now() - startedAt, type: "stderr", bytes: chunk.length }));
  });

  const interval = setInterval(() => {
    void takeSnapshot(`${Math.round((Date.now() - startedAt) / 1000)}s`);
  }, SNAPSHOT_MS);

  const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null; timedOut: boolean }>((resolveExit) => {
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      resolveExit({ code: null, signal: "SIGTERM", timedOut: true });
    }, TIMEOUT_MS);
    child.on("exit", (code, signal) => {
      clearTimeout(timeout);
      resolveExit({ code, signal, timedOut: false });
    });
  });

  clearInterval(interval);
  await takeSnapshot("final");

  await writeFile(join(outDir, "terminal.log"), log);
  await writeFile(join(outDir, "events.jsonl"), events.join("\n") + "\n");
  await writeFile(join(outDir, "metadata.json"), JSON.stringify({
    journeyId: journey.id,
    title: journey.title,
    startedAt: new Date(startedAt).toISOString(),
    elapsedMs: Date.now() - startedAt,
    exit,
    width: WIDTH,
    height: HEIGHT,
  }, null, 2));

  return outDir;
}

function judgePrompt(outDir: string) {
  return `You are judging the UX of the \`research\` Ink CLI for one canonical user journey.

Workspace: ${process.cwd()}
Run directory: ${outDir}

Read:
- ${join(outDir, "journey.md")}
- ${join(outDir, "terminal.log")}
- ${join(outDir, "events.jsonl")}
- ${join(outDir, "metadata.json")}
- text snapshots under ${join(outDir, "snapshots")}
- screenshot files under ${join(outDir, "screenshots")}

Your job:
1. Reconstruct what the user experienced from the screenshots/snapshots first, then use logs to verify exact text.
2. Decide whether \`research\` chose the right behavior: clarify, plan, start work, retrieve, wait, report block, or debug.
3. Identify every confusing moment visible to a normal user. Be concrete and reference snapshot filenames or log evidence.
4. Separate product confusion from dataset confusion, auth confusion, run lifecycle confusion, and terminal/UI readability problems.
5. Judge whether the displayed information was too sparse, right-sized, or too dense for this journey.
6. Return a Markdown briefing with:
   - Verdict: Pass, Partial, or Fail.
   - User input burden.
   - Correct behavior assessment.
   - Confusing moments ordered by severity.
   - Missing information that would have helped.
   - Information that should be removed or de-emphasized.
   - Suggested UI/output changes.
   - Evidence references to screenshots/snapshots/log timestamps.

Do not modify files. Return only the Markdown briefing. Focus on what a user would understand from the CLI.`;
}

async function runJudge(outDir: string) {
  const briefingPath = join(outDir, "briefing.md");
  const child = spawn("codex", [
    "exec",
    "--dangerously-bypass-approvals-and-sandbox",
    "--ignore-user-config",
    "--ignore-rules",
    "-m",
    process.env.JOURNEY_JUDGE_MODEL ?? "gpt-5.4-mini",
    "-C",
    process.cwd(),
    "-o",
    briefingPath,
    judgePrompt(outDir),
  ], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });
  const code = await new Promise<number | null>((resolveCode) => {
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      resolveCode(null);
    }, JUDGE_TIMEOUT_MS);
    child.on("exit", (exitCode) => {
      clearTimeout(timeout);
      resolveCode(exitCode);
    });
  });
  await writeFile(join(outDir, "judge.log"), output);
  if (!existsSync(briefingPath)) {
    const trimmed = output.trim();
    await writeFile(briefingPath, trimmed
      ? `${trimmed}\n`
      : `# Judge Failed\n\nCodex exited with ${code} and produced no briefing output.\n`);
  }
}

async function main() {
  const { ids, outRoot, judgeOnly, noJudge, noRun } = parseArgs();
  await mkdir(outRoot, { recursive: true });

  const selected = ids.map((id) => {
    const journey = JOURNEYS.find((candidate) => candidate.id === id);
    if (!journey) throw new Error(`Unknown journey id ${id}`);
    return journey;
  });

  const runDirs: string[] = [];
  if (!judgeOnly && !noRun) {
    for (const journey of selected) {
      console.log(`Running ${journey.id}: ${journey.title}`);
      const outDir = await runJourney(journey, outRoot);
      runDirs.push(outDir);
      console.log(`Captured ${outDir}`);
    }
  } else {
    for (const journey of selected) {
      const journeyRoot = join(outRoot, journey.id);
      const latest = await latestRunDir(journeyRoot);
      if (!latest) throw new Error(`No run found for ${journey.id} under ${journeyRoot}`);
      runDirs.push(latest);
    }
  }

  if (!noJudge) {
    for (const outDir of runDirs) {
      console.log(`Judging ${outDir}`);
      await runJudge(outDir);
      console.log(`Briefing ${join(outDir, "briefing.md")}`);
    }
  }
}

async function latestRunDir(root: string) {
  try {
    const { readdir, stat } = await import("node:fs/promises");
    const entries = await readdir(root);
    const dirs = [];
    for (const entry of entries) {
      const full = join(root, entry);
      if ((await stat(full)).isDirectory()) dirs.push(full);
    }
    return dirs.sort().at(-1);
  } catch {
    return null;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
