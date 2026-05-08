import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import { initialPromptModeStatus, isDirectCliExecution, shouldExitPromptMode } from "../src/index.js";

test("prompt mode shows immediate metadata status for field-definition questions", () => {
  assert.equal(
    initialPromptModeStatus("In the tweets dataset, what does quote_tweet_count mean and can I use it to define virality?"),
    "Checking dataset metadata...",
  );
});

test("prompt mode shows immediate run-status feedback for run inspection questions", () => {
  assert.equal(
    initialPromptModeStatus("What is happening with my last run status?"),
    "Checking run state...",
  );
});

test("prompt mode shows immediate recovery feedback for blocked-or-failed work questions", () => {
  assert.equal(
    initialPromptModeStatus("Something seems blocked or failed. Tell me what is happening, whether anything useful was produced, and what I should do next."),
    "Checking active work, useful outputs, and the best next step...",
  );
});

test("prompt mode shows continuity-specific feedback for return-later questions", () => {
  assert.equal(
    initialPromptModeStatus("I came back later. What happened with my research work, and what results or artifacts can I see?"),
    "Checking recent research work...",
  );
});

test("prompt mode treats completed-run decision prompts as run-state retrieval", () => {
  assert.equal(
    initialPromptModeStatus("The last run finished. Explain what changed, what artifacts I have, whether the result is trustworthy, and what decision I should make next."),
    "Checking run state...",
  );
});

test("prompt mode treats dataset-choice prompts as dataset inspection work", () => {
  assert.equal(
    initialPromptModeStatus("I want to study housing affordability. Which dataset should I use?"),
    "Looking up candidate datasets...",
  );
});

test("prompt mode shows an explicit input-needed state for vague housing risk questions", () => {
  assert.equal(
    initialPromptModeStatus("Can you look into whether the housing market is in trouble?"),
    "Needs your input: scope clarification.",
  );
});

test("prompt mode shows an approval gate immediately for broad all-data opportunity requests", () => {
  assert.equal(
    initialPromptModeStatus("Run whatever analysis you think is best on all my data and tell me the biggest business opportunities."),
    "Needs your approval: scope a bounded study before any remote work.",
  );
});

test("prompt mode treats dataset briefing prompts as dataset inspection work", () => {
  assert.equal(
    initialPromptModeStatus("Describe the econ dataset for me."),
    "Inspecting econ: sources, schema, coverage, quality, limitations...",
  );
});

test("prompt mode treats dataset trust prompts as readiness checks", () => {
  assert.equal(
    initialPromptModeStatus("Before I use the econ dataset, help me understand what's inside it, where it came from, and whether I can trust it."),
    "Readiness check for econ: trust, coverage, join keys, missingness, fix-first verdict...",
  );
});

test("prompt mode surfaces a fix-first readiness label for trust-before-study prompts", () => {
  assert.equal(
    initialPromptModeStatus("Can I trust the econ dataset enough to use it for a county-month housing affordability study, or do we need to fix it first?"),
    "Readiness check for econ: trust, coverage, join keys, missingness, fix-first verdict...",
  );
});

test("prompt mode treats fully specified dataset experiments generically", () => {
  assert.equal(
    initialPromptModeStatus("Using econ, test whether housing price growth predicts county employment growth and produce a table plus one chart."),
    "Thinking...",
  );
});

test("prompt mode kickoff for fully specified experiments stays generic", async () => {
  const child = spawn(process.execPath, ["--import", "tsx", "apps/cli/src/index.ts", "--prompt", "Using econ, test whether housing price growth predicts county employment growth and produce a table plus one chart."], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      RESEARCH_DISABLE_RUN_WATCHER: "1",
      RESEARCH_SESSION_DIR: join(process.cwd(), ".tmp", "research-test-prompt-viral-kickoff"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("prompt kickoff did not exit cleanly"));
    }, 4000);
    child.on("exit", (code, signal) => {
      clearTimeout(timeout);
      resolve({ code, signal });
    });
  });

  assert.equal(result.signal, null);
  assert.equal(result.code, 0);
  assert.match(stdout, /Sign in first with `\/login`/);
  assert.doesNotMatch(stdout, /top 0\.1%|strict JSON|representative examples|quote_tweet_count/i);
  assert.equal(stderr, "");
});

test("version flag prints package version without starting interactive UI", async () => {
  const child = spawn(process.execPath, ["--import", "tsx", "apps/cli/src/index.ts", "--version"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      RESEARCH_DISABLE_RUN_WATCHER: "1",
      RESEARCH_SESSION_DIR: join(process.cwd(), ".tmp", "research-test-version"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("version flag did not exit cleanly"));
    }, 4000);
    child.on("exit", (code, signal) => {
      clearTimeout(timeout);
      resolve({ code, signal });
    });
  });

  assert.equal(result.signal, null);
  assert.equal(result.code, 0);
  const packageJson = JSON.parse(await readFile(join(process.cwd(), "apps/cli/package.json"), "utf8")) as { version: string };
  assert.equal(stdout.trim(), packageJson.version);
  assert.equal(stderr, "");
});

test("prompt mode treats dataset creation prompts as immediate creation work", () => {
  assert.equal(
    initialPromptModeStatus("Create a dataset from /tmp/enriched_tweets.parquet, name it Enriched Tweets, and deploy it."),
    "Starting dataset creation...",
  );
});

test("direct cli execution resolves relative entry paths", () => {
  assert.equal(isDirectCliExecution("apps/cli/src/index.ts"), true);
});

test("prompt mode exits for the built cli entry", () => {
  assert.equal(shouldExitPromptMode("apps/cli/dist/index.js"), true);
});
