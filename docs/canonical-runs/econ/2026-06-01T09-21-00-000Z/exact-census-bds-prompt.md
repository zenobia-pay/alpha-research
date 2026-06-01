# Exact Econ Improvement: Census Business Dynamics Statistics

You are running an admin-owned canonical dataset improvement for `econ`.

Objective: add one validated provider-native public economics dataset: Census Business Dynamics Statistics (BDS) annual firm and establishment dynamics from the Census API.

Why this matters: BDS fills a firm dynamics gap: firm births and deaths, establishment openings and closings, job creation and destruction, contractions and expansions, employment, payroll, and establishment counts across geography, industry, age, and size dimensions.

Hard rules:

- Use the mounted canonical dataset directory for `econ`. Prefer `$DATASET_DIR`, then `$DATASET_MOUNT_PATH`, then `/data/datasets/econ`.
- Do not work on BEA ITD or BLS BED. Do not inspect, repair, profile, or mention `raw/bea_itd` or `raw/bls_bed` except in diagnostics if they block the run.
- Do not create derived analysis tables.
- Preserve provider API responses and metadata under `$DATASET_DIR/raw/census_bds/`.
- Start `dataset_briefing.md` from the existing real briefing, not a placeholder.
- Do not update the backend profile unless `dataset_briefing.md` contains a real Census BDS bullet for `raw/census_bds/` and contains no `Startup placeholder`, `startup_placeholder_not_final`, or `must be filled`.

Required first commands:

```bash
RUN_ID="${REMOTE_AGENT_EXECUTION_ID:-${RUN_ID:-}}"
if [ -z "$RUN_ID" ] && [ -f run_config.json ]; then RUN_ID="$(node -e "const c=require('./run_config.json'); console.log(c.remoteAgentExecutionId||c.executionId||c.runId||'')" 2>/dev/null || true)"; fi
if [ -z "$RUN_ID" ]; then RUN_ID="$(basename "$PWD")"; fi
DATASET_DIR="${DATASET_DIR:-${DATASET_MOUNT_PATH:-/data/datasets/econ}}"
ARTIFACT_DIR="${ARTIFACT_DIR:-/results/$RUN_ID}"
mkdir -p "$ARTIFACT_DIR"
printf '# Work Log\n\nStarted exact Census BDS econ improvement.\n' > work.md
printf '<!doctype html><title>Census BDS econ improvement</title><h1>Census BDS econ improvement</h1>\n' > report.html
if [ -f "$DATASET_DIR/dataset_briefing.md" ]; then cp "$DATASET_DIR/dataset_briefing.md" dataset_briefing.md; else printf '# Data Inventory\n' > dataset_briefing.md; fi
cat > improvement_result.json <<JSON
{"status":"blocked","blocker":"not_completed_yet","datasetId":"econ","runId":"$RUN_ID","briefingBytes":$(wc -c < dataset_briefing.md),"profileReadbackVerified":false}
JSON
cp work.md report.html dataset_briefing.md improvement_result.json "$ARTIFACT_DIR"/
```

Required work:

1. Verify `$DATASET_DIR` exists and is writable. If not, keep startup artifacts, write a blocked `improvement_result.json`, copy artifacts, and stop.
2. Create `$DATASET_DIR/raw/census_bds/`.
3. Discover the live BDS API group and variables from Census API metadata. Try these metadata URLs and save successful JSON responses:
   - `https://api.census.gov/data/timeseries/bds.json`
   - `https://api.census.gov/data/timeseries/bds/variables.json`
   - `https://api.census.gov/data/timeseries/bds/firms.json`
   - `https://api.census.gov/data/timeseries/bds/firms/variables.json`
4. Download at least one broad provider-native BDS API response. Prefer national all-year firm/establishment dynamics if available; otherwise use the broadest live endpoint discovered from metadata. Save the raw JSON response and the exact URL used under `$DATASET_DIR/raw/census_bds/`.
5. Inspect and record row count, time coverage, geography, variables/fields, and caveats directly from the saved response and metadata.
6. Update or append dataset inventories when present: `download_inventory.csv`, `download_inventory.jsonl`, `download_events.jsonl`, `raw_inventory.csv`, `raw_inventory.jsonl`, `source_registry.csv`, `source_registry.plan.json`, `manifest.json`, `quality_report.md`, `data_dictionary.md`.
7. Rewrite `$DATASET_DIR/dataset_briefing.md` as a literal inventory of actual data on disk, preserving existing valid bullets and adding a measured Census BDS bullet. The bullet must mention:
   - `raw/census_bds/`
   - Census Business Dynamics Statistics
   - exact saved file names
   - row count
   - time coverage
   - geography
   - main variables/fields
   - provider API caveats
8. Copy the exact final briefing to `./dataset_briefing.md` and `$ARTIFACT_DIR/dataset_briefing.md`.
9. Write `improvement_result.json` with `status: "completed"`, the measured BDS facts, `briefingBytes`, `profileReadbackVerified`, and `blocker: null`. Copy it to `$ARTIFACT_DIR`.
10. Before profile update, run this guard and block if it matches:

```bash
grep -q 'Startup placeholder\|startup_placeholder_not_final\|must be filled' dataset_briefing.md improvement_result.json
```

11. Update the backend profile only after the guard returns non-zero and `grep -q 'raw/census_bds/' dataset_briefing.md` succeeds.
12. Read the profile back and verify `briefingMarkdown` contains `raw/census_bds/` and `volumeInventoryRunId` or `describedRunId` equals this run id.

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
