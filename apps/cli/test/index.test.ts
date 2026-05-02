import assert from "node:assert/strict";
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

test("prompt mode treats dataset-choice prompts as dataset inspection work", () => {
  assert.equal(
    initialPromptModeStatus("I want to study housing affordability. Which dataset should I use?"),
    "Inspecting dataset details...",
  );
});

test("prompt mode shows an explicit input-needed state for vague housing risk questions", () => {
  assert.equal(
    initialPromptModeStatus("Can you look into whether the housing market is in trouble?"),
    "Needs your input: scope clarification.",
  );
});

test("prompt mode treats dataset briefing prompts as dataset inspection work", () => {
  assert.equal(
    initialPromptModeStatus("Describe the econ dataset for me."),
    "Inspecting dataset details...",
  );
});

test("prompt mode treats fully specified tweet experiments as immediate research work", () => {
  assert.equal(
    initialPromptModeStatus("Using enriched-tweets, define viral tweets as the top 0.1% by quote_tweet_count. Randomly sample 100 viral tweets, label each for hook_type, emotional_tone, and controversy_level using strict JSON, then produce a bar chart and 10 representative examples."),
    "Planning dataset-backed research...",
  );
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
