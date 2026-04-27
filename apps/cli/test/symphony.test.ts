import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  createWorkspace,
  loadWorkflow,
  renderPrompt,
  resolveSymphonyConfig,
  sanitizeWorkspaceKey,
  type SymphonyIssue,
} from "../src/symphony.js";

const issue: SymphonyIssue = {
  id: "issue-id",
  identifier: "ABC-123",
  title: "Implement the thing",
  description: "Body",
  priority: 1,
  state: "Todo",
  branch_name: "abc-123",
  url: "https://linear.app/example/issue/ABC-123",
  labels: ["backend"],
  blocked_by: [],
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
};

async function tempDir() {
  return mkdtemp(join(tmpdir(), "research-symphony-"));
}

test("loads workflow front matter and resolves typed config defaults", async () => {
  const root = await tempDir();
  try {
    const workflowPath = join(root, "WORKFLOW.md");
    await writeFile(workflowPath, `---
tracker:
  kind: linear
  api_key: $TEST_LINEAR_API_KEY
  project_slug: project-a
workspace:
  root: .workspaces
agent:
  max_concurrent_agents_by_state:
    Todo: 2
    Bad: 0
codex:
  command: "codex app-server --experimental"
---
Work on {{ issue.identifier }} attempt={{ attempt }}.
`);

    const workflow = await loadWorkflow(workflowPath);
    const config = resolveSymphonyConfig(workflow, { TEST_LINEAR_API_KEY: "linear-token" });

    assert.equal(workflow.prompt_template, "Work on {{ issue.identifier }} attempt={{ attempt }}.");
    assert.equal(config.tracker.endpoint, "https://api.linear.app/graphql");
    assert.equal(config.tracker.apiKey, "linear-token");
    assert.equal(config.workspace.root, join(root, ".workspaces"));
    assert.equal(config.agent.maxConcurrentAgentsByState.get("todo"), 2);
    assert.equal(config.agent.maxConcurrentAgentsByState.has("bad"), false);
    assert.equal(config.codex.command, "codex app-server --experimental");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("workflow loader reports typed errors", async () => {
  const root = await tempDir();
  try {
    const missing = join(root, "missing.md");
    await assert.rejects(() => loadWorkflow(missing), /Unable to read workflow file/);

    const listWorkflow = join(root, "list.md");
    await writeFile(listWorkflow, "---\n- nope\n---\nPrompt");
    await assert.rejects(() => loadWorkflow(listWorkflow), /front matter must decode to a YAML map/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("strict prompt rendering exposes issue and attempt", async () => {
  assert.equal(await renderPrompt("{{ issue.identifier }} {{ attempt }}", issue, 3), "ABC-123 3");
  await assert.rejects(() => renderPrompt("{{ missing.value }}", issue, null), /undefined variable/);
});

test("workspace keys are sanitized and created under the configured root", async () => {
  const root = await tempDir();
  try {
    assert.equal(sanitizeWorkspaceKey("ABC 123/unsafe"), "ABC_123_unsafe");
    const workflowPath = join(root, "WORKFLOW.md");
    await writeFile(workflowPath, `---
tracker:
  kind: linear
  api_key: literal
  project_slug: project-a
workspace:
  root: workspaces
---
Prompt
`);
    const config = resolveSymphonyConfig(await loadWorkflow(workflowPath));
    const workspace = await createWorkspace(config, { ...issue, identifier: "ABC 123/unsafe" });
    assert.equal(workspace.workspace_key, "ABC_123_unsafe");
    assert.equal(workspace.path, join(root, "workspaces", "ABC_123_unsafe"));
    assert.equal(workspace.created_now, true);
    const reused = await createWorkspace(config, { ...issue, identifier: "ABC 123/unsafe" });
    assert.equal(reused.created_now, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
