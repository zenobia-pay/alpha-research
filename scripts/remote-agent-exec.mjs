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

const rawPrompt = readPrompt();
const kind = argValue(argv, "--kind") ?? "manual";
const datasetId = argValue(argv, "--dataset-id");

function datasetArtifactContractPrompt(promptText) {
  if (!datasetId) return promptText;
  return [
    promptText.trimEnd(),
    "",
    "## Non-Optional Artifact Promotion Contract",
    "",
    "Before the final response, copy the primary artifacts into the exact remote result directory so the orchestrator can collect them:",
    "",
    "```bash",
    "RESULT_DIR=${RESULT_DIR:-/results/$RUN_ID}",
    "mkdir -p \"$RESULT_DIR/docs/public-datasets/briefings\"",
    "cp \"$DATASET_DIR/dataset_briefing.md\" \"$RESULT_DIR/dataset_briefing.md\"",
    "cp \"$DATASET_DIR/improvement_result.json\" \"$RESULT_DIR/improvement_result.json\"",
    "cp \"$DATASET_DIR/work.md\" \"$RESULT_DIR/work.md\"",
    "cp \"$DATASET_DIR/report.html\" \"$RESULT_DIR/report.html\"",
    "cp \"$DATASET_DIR/docs/public-datasets/briefings/econ.md\" \"$RESULT_DIR/docs/public-datasets/briefings/econ.md\" 2>/dev/null || true",
    "cp \"$DATASET_DIR/docs/public-datasets/econ.mdx\" \"$RESULT_DIR/docs/public-datasets/econ.mdx\" 2>/dev/null || true",
    "```",
    "",
    "If `$RUN_ID` or `$RESULT_DIR` is unavailable, discover the result directory under `/results` and copy the same files there. Do not finish until `ls -l \"$RESULT_DIR\"` shows `dataset_briefing.md`, `improvement_result.json`, `work.md`, and `report.html`.",
  ].join("\n");
}

const prompt = datasetArtifactContractPrompt(rawPrompt);

const canonicalDatasetResources = {
  profile: "standard-analysis",
  backend: "modal",
  resourceProfile: "standard-analysis",
  cpu: 8,
  memoryGb: 16,
  workspaceDiskGb: 100,
  storageMode: "modal-volume",
  datasetAccess: "write-version",
  publishMode: "versioned",
};

const datasetArtifactSpec = [
  { type: "file", title: "Runtime Report", path: "report.html" },
  { type: "file", title: "Runtime Work Log", path: "work.md" },
  { type: "structured_result", title: "Improvement Result", path: "improvement_result.json" },
  { type: "file", title: "Dataset Briefing", path: "dataset_briefing.md" },
];

const body = {
  prompt,
  kind,
  ...(datasetId ? { datasetId } : {}),
  ownerType: "admin",
  ...(datasetId ? {
    resources: canonicalDatasetResources,
    artifactSpec: datasetArtifactSpec,
    requiredArtifacts: datasetArtifactSpec.map((artifact) => artifact.path),
  } : {}),
  metadata: {
    launchedBy: "scripts/remote-agent-exec.mjs",
    promptMode: "exact",
    ...(datasetId ? {
      datasetId,
      resources: canonicalDatasetResources,
      requiresWritableDatasetDir: true,
      exactDatasetScopedExecution: true,
    } : {}),
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
