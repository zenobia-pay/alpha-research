import assert from "node:assert/strict";
import test from "node:test";

import { dashboardRunUrl } from "../src/config.js";
import { getToolRegistryMetadata, validateToolRegistry } from "../src/tool-registry.js";

test("tool registry is structurally valid and serializable", () => {
  const result = validateToolRegistry();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.ok(result.tools.includes("create_research_environment"));
  assert.ok(result.tools.includes("get_run_results"));
});

test("tool registry metadata exposes async run-start tools", () => {
  const metadata = getToolRegistryMetadata();
  const query = metadata.find((tool) => tool.name === "query_remote_dataset");
  assert.equal(query?.asyncRunStart, true);
  assert.equal(metadata.every((tool) => typeof tool.description === "string" && tool.description.length > 0), true);
});

test("dashboard run links use canonical dashboard route", () => {
  assert.equal(
    dashboardRunUrl("https://alpharesearch.nyc", "run_123"),
    "https://dashboard.alpharesearch.nyc/?view=runs&runId=run_123#run-run_123",
  );
});
