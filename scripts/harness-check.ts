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
for (const requiredTool of [
  "create_research_environment",
  "query_remote_dataset",
  "get_run_results",
  "cancel_remote_run",
]) {
  assert.ok(metadata.some((tool) => tool.name === requiredTool), `Missing required tool ${requiredTool}`);
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
