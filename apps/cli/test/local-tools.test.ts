import assert from "node:assert/strict";
import test from "node:test";

import { formatDuration } from "../src/local-tools.js";

test("formatDuration normalizes rounded minute boundaries", () => {
  assert.equal(formatDuration(959.6), "16m");
  assert.equal(formatDuration(59.6), "1m");
  assert.equal(formatDuration(60.4), "1m");
});
