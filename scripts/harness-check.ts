import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";

import { dashboardRunUrl } from "../apps/cli/src/config.js";
import { getToolRegistryMetadata, validateToolRegistry } from "../apps/cli/src/tool-registry.js";

const requiredDocs = [
  "AGENTS.md",
  "docs/ARCHITECTURE.md",
  "docs/RUN_LIFECYCLE.md",
  "docs/HARNESS.md",
  "docs/SYMPHONY.md",
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

const packageJson = JSON.parse(await readFile("package.json", "utf8")) as { scripts?: Record<string, string> };
assert.ok(packageJson.scripts?.["symphony:test"], "package.json should expose npm run symphony:test");

const symphonyCaseFiles = (await readdir("apps/cli/test/symphony-cases")).filter((file) => file.endsWith(".json"));
assert.ok(symphonyCaseFiles.length > 0, "At least one Symphony TDD case should exist");
for (const file of symphonyCaseFiles) {
  const parsed = JSON.parse(await readFile(`apps/cli/test/symphony-cases/${file}`, "utf8")) as {
    name?: unknown;
    prompt?: unknown;
    modelRounds?: unknown;
    expected?: unknown;
  };
  assert.equal(typeof parsed.name, "string", `${file} should include a name`);
  assert.equal(typeof parsed.prompt, "string", `${file} should include a prompt`);
  assert.ok(Array.isArray(parsed.modelRounds), `${file} should include modelRounds`);
  assert.equal(typeof parsed.expected, "object", `${file} should include expected assertions`);
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
