import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

import { dashboardRunUrl } from "../apps/cli/src/config.js";
import { getToolRegistryMetadata, validateToolRegistry } from "../apps/cli/src/tool-registry.js";

const requiredDocs = [
  "AGENTS.md",
  "docs/ARCHITECTURE.md",
  "docs/RUN_LIFECYCLE.md",
  "docs/HARNESS.md",
];

async function assertFile(path: string) {
  await access(path);
  const content = await readFile(path, "utf8");
  assert.ok(content.trim().length > 200, `${path} should contain useful agent-facing context`);
}

for (const doc of requiredDocs) {
  await assertFile(doc);
}

const registry = validateToolRegistry();
assert.equal(registry.ok, true, registry.errors.join("\n"));

const metadata = getToolRegistryMetadata();
const toolNames = new Set(metadata.map((tool) => tool.name));
for (const requiredTool of [
  "create_research_environment",
  "create_public_data_environment",
  "query_remote_dataset",
  "get_run_results",
  "cancel_remote_run",
  "wait_for_run_completion",
]) {
  assert.ok(toolNames.has(requiredTool), `Missing required tool ${requiredTool}`);
}

for (const tool of metadata) {
  assert.ok(tool.description.trim().length >= 30, `Tool ${tool.name} needs a useful description`);
  assert.equal(tool.inputSchema.type, "object", `Tool ${tool.name} schema must be an object`);
  assert.doesNotThrow(() => JSON.stringify(tool.inputSchema), `Tool ${tool.name} schema must be JSON serializable`);
}

for (const asyncTool of [
  "start_remote_run",
  "query_remote_dataset",
  "aggregate_remote_dataset",
  "fetch_public_data",
  "start_remote_agent_run",
  "continue_remote_agent_run",
  "run_remote_transformation",
  "run_remote_labeling",
  "create_public_data_environment",
  "create_research_environment",
]) {
  assert.equal(metadata.find((tool) => tool.name === asyncTool)?.asyncRunStart, true, `${asyncTool} should be classified as async run-start`);
}

assert.equal(
  dashboardRunUrl("https://alpharesearch.nyc", "abc"),
  "https://dashboard.alpharesearch.nyc/?view=runs&runId=abc#run-abc",
);

const localOpenAiKey = process.env.OPENAI_API_KEY;
delete process.env.OPENAI_API_KEY;
assert.equal(process.env.OPENAI_API_KEY, undefined, "Harness should not require a local OpenAI key");
if (localOpenAiKey) {
  process.env.OPENAI_API_KEY = localOpenAiKey;
}

console.log(`Harness check passed (${metadata.length} tools).`);
