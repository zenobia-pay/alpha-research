import assert from "node:assert/strict";
import test from "node:test";

import { initialPromptModeStatus, isDirectCliExecution } from "../src/index.js";

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

test("prompt mode treats dataset briefing prompts as dataset inspection work", () => {
  assert.equal(
    initialPromptModeStatus("Describe the econ dataset for me."),
    "Inspecting dataset details...",
  );
});

test("direct cli execution resolves relative entry paths", () => {
  assert.equal(isDirectCliExecution("apps/cli/src/index.ts"), true);
});
