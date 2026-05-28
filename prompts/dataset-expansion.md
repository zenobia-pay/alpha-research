# Expand Dataset: {datasetName} (`{datasetId}`)

You are expanding one canonical public dataset folder. The goal is to get all of the data relevant to economics into durable canonical storage over repeated runs. Prioritize full, raw, provider-native datasets that are useful and comprehensive for economics researchers: macroeconomic indicators, prices and inflation, labor markets, income, banking and credit, housing, business formation, trade, public finance, monetary policy, firm dynamics, household microdata, and other broad economic evidence. Prefer authoritative public sources, complete bulk downloads, clear provenance, and files that preserve the provider's original structure. Do not create derived analysis tables as canonical artifacts.

## Runtime Setup

Use this setup before planning:

```bash
RUN_ID="${REMOTE_AGENT_EXECUTION_ID:-${RUN_ID:-}}"
if [ -z "$RUN_ID" ] && [ -f run_config.json ]; then
  RUN_ID="$(node -e "const c=require('./run_config.json'); console.log(c.remoteAgentExecutionId||c.executionId||c.runId||'')" 2>/dev/null || true)"
fi
if [ -z "$RUN_ID" ]; then RUN_ID="$(basename "$PWD")"; fi

DATASET_DIR_CANDIDATES="${DATASET_DIR:-} ${DATASET_MOUNT_PATH:-} /mnt/alpha-research/datasets/{datasetId} /data/datasets/{datasetId} ./dataset"
DATASET_DIR=""
for candidate in $DATASET_DIR_CANDIDATES; do
  if [ -d "$candidate" ]; then DATASET_DIR="$(cd "$candidate" && pwd -P)"; break; fi
done
if [ -z "$DATASET_DIR" ]; then DATASET_DIR="${DATASET_MOUNT_PATH:-/mnt/alpha-research/datasets/{datasetId}}"; fi

ARTIFACT_DIR="${ARTIFACT_DIR:-/results/$RUN_ID}"
mkdir -p "$ARTIFACT_DIR"
printf '# Work Log\n\nStarted dataset expansion for {datasetId}.\n' > work.md
printf '<!doctype html><title>Dataset expansion</title><h1>Dataset expansion started</h1>\n' > report.html
cp work.md report.html "$ARTIFACT_DIR"/
```

If `$DATASET_DIR` is missing or not writable, write `improvement_result.json` with `"status": "blocked"` and a non-secret `blocker`, copy any existing `dataset_briefing.md` you can read, copy required artifacts to `$ARTIFACT_DIR`, and stop.

## Job

1. Inspect `$DATASET_DIR`, especially existing raw files, inventories, manifest files, source registry files, and `dataset_briefing.md`.
2. Find and download one high-value public raw dataset that materially expands `{datasetId}`. For `econ`, prefer broad, authoritative economics data over small samples or blocked/partial attempts.
3. Store provider-native files under `$DATASET_DIR/raw/<source>/`.
4. Update provenance, download inventory, raw inventory, manifest, and source registry files under `$DATASET_DIR` when those files exist.
5. Rewrite `$DATASET_DIR/dataset_briefing.md` as a literal inventory of data actually on disk, then copy it to `./dataset_briefing.md` and `$ARTIFACT_DIR/dataset_briefing.md`.
6. Update the CLI-visible dataset profile from the exact briefing body and read it back. Completion requires readback to show this run id in the profile proof.
7. Copy `work.md`, `report.html`, `dataset_briefing.md`, and `improvement_result.json` to `$ARTIFACT_DIR`.

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
  "datasetId": "{datasetId}",
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
  ]
}
```

Before final response, this must succeed:

```bash
ls -l work.md report.html dataset_briefing.md improvement_result.json
ls -l "$ARTIFACT_DIR/work.md" "$ARTIFACT_DIR/report.html" "$ARTIFACT_DIR/dataset_briefing.md" "$ARTIFACT_DIR/improvement_result.json"
```

Return only:

```md
status: completed|blocked
dataset_id: {datasetId}
run_id: <run id>
dataset_dir: <dataset dir>
artifact_dir: <artifact dir>
briefing_bytes: <bytes>
blockers:
- <none or blocker>
```
