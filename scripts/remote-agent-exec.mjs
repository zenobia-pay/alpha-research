import { readFileSync } from "node:fs";
import {
  adminExecutionArtifactsUrl,
  adminExecutionStatusUrl,
  argValue,
  assert,
  defaultOrigin,
  executionIdFromResponse,
  postAdminJson,
} from "./admin-remote-agent.mjs";

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");

function readPrompt() {
  const prompt = argValue(argv, "--prompt");
  const promptFile = argValue(argv, "--prompt-file");
  assert(!(prompt && promptFile), "Use either --prompt or --prompt-file, not both.");
  if (promptFile) return readFileSync(promptFile, "utf8");
  assert(prompt, "Usage: npm run remote-agent:exec -- --prompt <prompt> [--kind manual] [--dataset-id id] [--dry-run]");
  return prompt;
}

const prompt = readPrompt();
const kind = argValue(argv, "--kind") ?? "manual";
const datasetId = argValue(argv, "--dataset-id");

const body = {
  prompt,
  kind,
  ...(datasetId ? { datasetId } : {}),
  ownerType: "admin",
  metadata: {
    launchedBy: "scripts/remote-agent-exec.mjs",
    promptMode: "exact",
  },
};

if (dryRun) {
  console.log(JSON.stringify({
    dryRun: true,
    endpoint: "/api/admin/remote-agent-executions",
    body,
  }, null, 2));
  process.exit();
}

try {
  const { endpoint, body: result } = await postAdminJson("/api/admin/remote-agent-executions", body);
  const executionId = executionIdFromResponse(result);
  console.log(JSON.stringify({
    status: "submitted",
    endpoint,
    executionId,
    adminStatusUrl: adminExecutionStatusUrl(executionId, defaultOrigin),
    artifactsUrl: adminExecutionArtifactsUrl(executionId, defaultOrigin),
    execution: result.execution ?? result.remoteAgentExecution ?? null,
    modal: result.modal ?? null,
    result,
  }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
