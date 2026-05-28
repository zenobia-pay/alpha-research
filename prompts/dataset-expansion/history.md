# Expand Dataset: History (`history`)

You are expanding the History (`history`) canonical public dataset folder. Scope: History: public archival records, newspapers, government documents, maps, manuscripts, oral histories, gazetteers, and historical metadata for social, political, cultural, and economic history. The goal is to get all durable public raw data relevant to this field into canonical storage over repeated runs. Prioritize full, raw, provider-native datasets, archives, metadata exports, APIs, corpora, and source packages that are useful and comprehensive for researchers in this field. Prefer authoritative public sources, complete bulk downloads, clear provenance, and files that preserve the provider's original structure. Do not create derived analysis tables as canonical artifacts.

## Runtime Setup

Use this setup before planning. `DATASET_DIR` or `DATASET_MOUNT_PATH` must already point at the writable canonical dataset mount.

```bash
RUN_ID="${REMOTE_AGENT_EXECUTION_ID:-${RUN_ID:-}}"
if [ -z "$RUN_ID" ] && [ -f run_config.json ]; then
  RUN_ID="$(node -e "const c=require('./run_config.json'); console.log(c.remoteAgentExecutionId||c.executionId||c.runId||'')" 2>/dev/null || true)"
fi
if [ -z "$RUN_ID" ]; then RUN_ID="$(basename "$PWD")"; fi

DATASET_DIR="${DATASET_DIR:-${DATASET_MOUNT_PATH:-}}"
ARTIFACT_DIR="${ARTIFACT_DIR:-/results/$RUN_ID}"
mkdir -p "$ARTIFACT_DIR"
printf '# Work Log\n\nStarted dataset expansion for history.\n' > work.md
printf '<!doctype html><title>Dataset expansion</title><h1>Dataset expansion started</h1>\n' > report.html
touch slack_download_alerts.jsonl
printf '# Slack Briefing\n\n' > slack_briefing.md

send_slack_lifecycle() {
  CHECKPOINT="$1" SUMMARY="$2" RUN_ID="$RUN_ID" node <<'NODE'
const fs = require("fs");
const payload = {
  event_type: "dataset_expansion_lifecycle",
  checkpoint: process.env.CHECKPOINT,
  dataset_id: "history",
  run_id: process.env.RUN_ID,
  summary: process.env.SUMMARY,
  delivery_at: new Date().toISOString(),
};
async function main() {
  const webhook = process.env.CANONICAL_DATASET_SLACK_WEBHOOK_URL;
  if (!webhook) {
    fs.appendFileSync("slack_download_alerts.jsonl", `${JSON.stringify({ ...payload, delivery_status: "pending", failure_reason: "missing CANONICAL_DATASET_SLACK_WEBHOOK_URL" })}\n`);
    return;
  }
  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `[dataset-expansion] history ${payload.checkpoint}: ${payload.summary}` }),
    });
    fs.appendFileSync("slack_download_alerts.jsonl", `${JSON.stringify({ ...payload, delivery_status: response.ok ? "sent" : "failed", http_status: response.status })}\n`);
  } catch (error) {
    fs.appendFileSync("slack_download_alerts.jsonl", `${JSON.stringify({ ...payload, delivery_status: "failed", failure_reason: error instanceof Error ? error.message : String(error) })}\n`);
  }
}
main().catch((error) => {
  fs.appendFileSync("slack_download_alerts.jsonl", `${JSON.stringify({ ...payload, delivery_status: "failed", failure_reason: error instanceof Error ? error.message : String(error) })}\n`);
});
NODE
}

send_slack_lifecycle started "Dataset expansion run started."
cp work.md report.html slack_download_alerts.jsonl slack_briefing.md "$ARTIFACT_DIR"/
```

If `$DATASET_DIR` is empty, missing, or not writable, write `improvement_result.json` with `"status": "blocked"` and a non-secret `blocker`, call `send_slack_lifecycle finished "<blocker>"`, copy any existing `dataset_briefing.md` you can read, copy required artifacts to `$ARTIFACT_DIR`, and stop. Do not search alternative dataset directories.

## Job

1. Inspect `$DATASET_DIR`, especially existing raw files, inventories, manifest files, source registry files, and `dataset_briefing.md`.
2. Find and download one high-value public raw dataset that materially expands `history`.
3. Store provider-native files under `$DATASET_DIR/raw/<source>/`.
4. Update provenance, download inventory, raw inventory, manifest, and source registry files under `$DATASET_DIR` when those files exist.
5. Rewrite `$DATASET_DIR/dataset_briefing.md` as a literal inventory of data actually on disk, then copy it to `./dataset_briefing.md` and `$ARTIFACT_DIR/dataset_briefing.md`.
6. Update the CLI-visible dataset profile from the exact briefing body and read it back. Completion requires readback to show this run id in the profile proof.
7. After writing `improvement_result.json`, call `send_slack_lifecycle finished "<actual dataset added>; <path added>; <records>; <coverage>"`.
8. Write `slack_briefing.md` with the start and finish Slack delivery status and the same downloaded-data summary from `expansionSummary`.
9. Copy `work.md`, `report.html`, `dataset_briefing.md`, `slack_download_alerts.jsonl`, `slack_briefing.md`, and `improvement_result.json` to `$ARTIFACT_DIR`.

## Briefing Rules

`dataset_briefing.md` must start with:

```md
# Data Inventory
```

Every bullet must describe concrete data present on disk: file/table, record grain, geography, time coverage, row/object counts when measurable, important fields, units, and caveats. Include the new dataset added by this run.

## Required Result JSON

Write `improvement_result.json` in the current directory and `$ARTIFACT_DIR`. Its top-level `status` must be exactly `"completed"` or `"blocked"`. Include this shape:

```json
{
  "status": "completed",
  "blocker": null,
  "datasetId": "history",
  "runId": "<run id>",
  "datasetDir": "<dataset dir>",
  "artifactDir": "<artifact dir>",
  "briefingBytes": 123,
  "profileRunId": "<run id>",
  "expansionSummary": {
    "actualNewDatasetAdded": "<plain English dataset name>",
    "pathAdded": "raw/<source>/<file>",
    "source": "<provider>",
    "coverage": "<time coverage>",
    "geography": "<geography>",
    "records": "<row/object count and grain>",
    "fields": "<important fields>",
    "caveat": "<refresh, access, quality, or interpretation caveat>"
  },
  "briefingChanges": [
    "<new or materially changed dataset_briefing.md bullet>"
  ],
  "slackLifecycleMessages": [
    {
      "checkpoint": "started",
      "delivery_status": "sent|pending|failed",
      "summary": "Dataset expansion run started."
    },
    {
      "checkpoint": "finished",
      "delivery_status": "sent|pending|failed",
      "summary": "<actual dataset added>; <path added>; <records>; <coverage>"
    }
  ]
}
```

Before final response, this must succeed:

```bash
ls -l work.md report.html dataset_briefing.md improvement_result.json
ls -l slack_download_alerts.jsonl slack_briefing.md
ls -l "$ARTIFACT_DIR/work.md" "$ARTIFACT_DIR/report.html" "$ARTIFACT_DIR/dataset_briefing.md" "$ARTIFACT_DIR/slack_download_alerts.jsonl" "$ARTIFACT_DIR/slack_briefing.md" "$ARTIFACT_DIR/improvement_result.json"
```

Return only:

```md
status: completed|blocked
dataset_id: history
run_id: <run id>
dataset_dir: <dataset dir>
artifact_dir: <artifact dir>
briefing_bytes: <bytes>
blockers:
- <none or blocker>
```
