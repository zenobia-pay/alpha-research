# Exact Econ Improvement: BLS Business Employment Dynamics

You are running an admin-owned canonical dataset improvement for `econ`.

Objective: add one validated provider-native public economics dataset: BLS Business Employment Dynamics (BED) all-data time series.

Hard rules:

- Use the mounted canonical dataset directory for `econ`. Prefer `$DATASET_DIR`, then `$DATASET_MOUNT_PATH`, then `/data/datasets/econ`.
- Do not work on BEA ITD. Do not inspect, repair, profile, or mention `raw/bea_itd` except in diagnostics if it blocks the run.
- Do not create derived analysis tables.
- Preserve provider-native files under `$DATASET_DIR/raw/bls_bed/`.
- Do not update the backend profile unless `dataset_briefing.md` is a real literal inventory and contains a BLS BED bullet for `raw/bls_bed/bd.data.1.AllData`.
- Never sync a startup placeholder briefing. If blocked, leave the backend profile unchanged.

Required first commands:

```bash
RUN_ID="${REMOTE_AGENT_EXECUTION_ID:-${RUN_ID:-}}"
if [ -z "$RUN_ID" ] && [ -f run_config.json ]; then RUN_ID="$(node -e "const c=require('./run_config.json'); console.log(c.remoteAgentExecutionId||c.executionId||c.runId||'')" 2>/dev/null || true)"; fi
if [ -z "$RUN_ID" ]; then RUN_ID="$(basename "$PWD")"; fi
DATASET_DIR="${DATASET_DIR:-${DATASET_MOUNT_PATH:-/data/datasets/econ}}"
ARTIFACT_DIR="${ARTIFACT_DIR:-/results/$RUN_ID}"
mkdir -p "$ARTIFACT_DIR"
printf '# Work Log\n\nStarted exact BLS BED econ improvement.\n' > work.md
printf '<!doctype html><title>BLS BED econ improvement</title><h1>BLS BED econ improvement</h1>\n' > report.html
printf '# Data Inventory\n- Startup placeholder: BLS BED has not yet been validated in this run.\n' > dataset_briefing.md
cat > improvement_result.json <<JSON
{"status":"blocked","blocker":"startup_placeholder_not_final","datasetId":"econ","runId":"$RUN_ID","briefingBytes":0,"profileReadbackVerified":false}
JSON
cp work.md report.html dataset_briefing.md improvement_result.json "$ARTIFACT_DIR"/
```

Required work:

1. Verify `$DATASET_DIR` exists and is writable. If not, keep the startup artifacts, write a blocked `improvement_result.json`, copy artifacts, and stop.
2. Download these provider files:
   - `https://download.bls.gov/pub/time.series/bd/bd.data.1.AllData`
   - `https://download.bls.gov/pub/time.series/bd/bd.series`
   - `https://download.bls.gov/pub/time.series/bd/bd.txt`
3. Store them exactly as downloaded under:
   - `$DATASET_DIR/raw/bls_bed/bd.data.1.AllData`
   - `$DATASET_DIR/raw/bls_bed/bd.series`
   - `$DATASET_DIR/raw/bls_bed/bd.txt`
4. Inspect row counts, first/last periods, main fields, and series count from the downloaded files.
5. Update or append dataset inventories when present: `download_inventory.csv`, `download_inventory.jsonl`, `download_events.jsonl`, `raw_inventory.csv`, `raw_inventory.jsonl`, `source_registry.csv`, `source_registry.plan.json`, `manifest.json`, `quality_report.md`, `data_dictionary.md`.
6. Rewrite `$DATASET_DIR/dataset_briefing.md` as a literal inventory of actual data on disk, preserving existing valid bullets and adding this BLS BED bullet:

```md
- `raw/bls_bed/bd.data.1.AllData`, `raw/bls_bed/bd.series`, `raw/bls_bed/bd.txt`: Bureau of Labor Statistics Business Employment Dynamics time-series package downloaded 2026-06-01. Provider files preserve the BED public time-series layout for quarterly gross job gains, gross job losses, establishment births, deaths, expansions, contractions, and related private-sector labor-market dynamics. The data file is tab-delimited with `series_id`, `year`, `period`, `value`, and footnote fields; the series file provides series metadata. Coverage, row count, and series count must be filled from direct file inspection before completion.
```

Replace the final sentence in that bullet with the measured coverage, row count, and series count. Do not leave "must be filled" text in the final briefing.

7. Copy the exact final briefing to `./dataset_briefing.md` and `$ARTIFACT_DIR/dataset_briefing.md`.
8. Write `improvement_result.json` with `status: "completed"`, the measured BLS BED facts, `briefingBytes`, `profileReadbackVerified`, and `blocker: null`. Copy it to `$ARTIFACT_DIR`.
9. Update the backend profile only after `grep -q 'Startup placeholder\|startup_placeholder_not_final\|must be filled' dataset_briefing.md improvement_result.json` returns non-zero.
10. Read the profile back and verify `briefingMarkdown` contains `raw/bls_bed/bd.data.1.AllData` and `volumeInventoryRunId` or `describedRunId` equals this run id.

Final response must be exactly:

```md
status: completed|blocked
dataset_id: econ
run_id: <run id>
briefing_bytes: <bytes>
profile_readback_verified: true|false
blockers:
- <none or blocker>
```
