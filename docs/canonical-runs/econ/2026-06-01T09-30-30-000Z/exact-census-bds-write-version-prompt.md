# Exact Econ Improvement: Census BDS Provider API Retry

You are running an admin-owned canonical dataset improvement for `econ`.

Objective: add one validated provider-native public economics dataset: Census Business Dynamics Statistics (BDS) annual firm and establishment dynamics from the Census API.

Why this matters: BDS fills a major firm-dynamics gap for economists: business births and deaths, establishment openings and closings, expansions and contractions, job creation and destruction, employment, payroll, firm age, establishment age, and size dynamics across time, geography, and industry.

Hard rules:

- Use the mounted canonical dataset directory for `econ`. Prefer `$DATASET_DIR`, then `$DATASET_MOUNT_PATH`, then `/data/datasets/econ`.
- Preserve raw provider API responses and metadata under `$DATASET_DIR/raw/census_bds/`.
- Do not create derived analysis tables, merged panels, model-ready extracts, or cross-source joins.
- Do not work on BEA ITD, BLS BED, ILOSTAT, OECD, FRED, or any non-BDS candidate. This run is BDS only.
- Start `dataset_briefing.md` from the existing real briefing on disk. Do not replace it with a one-source briefing.
- The final `dataset_briefing.md` must still contain these existing inventory markers:
  - `raw/federal_reserve_z1/z1_csv_files_20260319.zip`
  - `raw/worldbank/WDI_CSV_2026_04_09.zip`
  - `raw/bis_cpmi/WS_CPMI_CASHLESS_csv_col.zip`
- Do not update the backend profile unless the final `dataset_briefing.md` contains a real measured BDS bullet for `raw/census_bds/` and contains none of: `Startup placeholder`, `startup_placeholder_not_final`, `must be filled`.

Required first commands:

```bash
RUN_ID="${REMOTE_AGENT_EXECUTION_ID:-${RUN_ID:-}}"
if [ -z "$RUN_ID" ] && [ -f run_config.json ]; then RUN_ID="$(node -e "const c=require('./run_config.json'); console.log(c.remoteAgentExecutionId||c.executionId||c.runId||'')" 2>/dev/null || true)"; fi
if [ -z "$RUN_ID" ]; then RUN_ID="$(basename "$PWD")"; fi
DATASET_DIR="${DATASET_DIR:-${DATASET_MOUNT_PATH:-/data/datasets/econ}}"
ARTIFACT_DIR="${ARTIFACT_DIR:-/results/$RUN_ID}"
mkdir -p "$ARTIFACT_DIR"
printf '# Work Log\n\nStarted exact Census BDS provider API retry.\n' > work.md
printf '<!doctype html><title>Census BDS econ retry</title><h1>Census BDS econ retry</h1>\n' > report.html
if [ -f "$DATASET_DIR/dataset_briefing.md" ]; then cp "$DATASET_DIR/dataset_briefing.md" dataset_briefing.md; else printf '# Data Inventory\n' > dataset_briefing.md; fi
cat > improvement_result.json <<JSON
{"status":"blocked","blocker":"not_completed_yet","datasetId":"econ","runId":"$RUN_ID","briefingBytes":$(wc -c < dataset_briefing.md),"profileReadbackVerified":false}
JSON
cp work.md report.html dataset_briefing.md improvement_result.json "$ARTIFACT_DIR"/
```

Required work:

1. Verify `$DATASET_DIR` exists and is writable using an actual create/delete probe, not only `test -w`: `probe="$DATASET_DIR/.canonical_write_probe_$RUN_ID"; printf ok > "$probe" && rm "$probe"`. If the probe fails, keep startup artifacts, write a blocked `improvement_result.json` with the non-secret filesystem blocker, copy artifacts, and stop.
2. Create `$DATASET_DIR/raw/census_bds/`.
3. Download and save BDS metadata JSON from these known Census API endpoints when they return HTTP 200:
   - `https://api.census.gov/data/timeseries/bds.json`
   - `https://api.census.gov/data/timeseries/bds/variables.json`
   - `https://api.census.gov/data/timeseries/bds/geography.json`
   - `https://api.census.gov/data/timeseries/bds/groups.json`
4. Use metadata to discover BDS variables and groups. Save every successful metadata response with a descriptive provider-native filename under `$DATASET_DIR/raw/census_bds/`, plus a `source_urls.txt` listing exact request URLs and UTC download timestamps.
5. Download at least one broad provider-native BDS data response that spans all available years. Prefer national all-industry/all-size/all-age annual observations if the API supports that shape. If one request is too large or requires dimensions, download the broadest documented national annual response and record the exact dimension constraints in `work.md` and `improvement_result.json`.
6. Save the raw BDS data response under `$DATASET_DIR/raw/census_bds/` without transforming it. It is acceptable to save Census API JSON arrays exactly as returned.
7. Inspect saved metadata and data response files directly. Measure:
   - saved filenames and byte sizes
   - row count excluding header
   - available year range in the saved data
   - geography level and geography values
   - key fields and variables
   - any Census API caveats or dimension constraints
8. Update or append dataset inventory files when present: `download_inventory.csv`, `download_inventory.jsonl`, `download_events.jsonl`, `raw_inventory.csv`, `raw_inventory.jsonl`, `source_registry.csv`, `source_registry.plan.json`, `manifest.json`, `quality_report.md`, and `data_dictionary.md`.
9. Rewrite `$DATASET_DIR/dataset_briefing.md` as a literal inventory of actual data on disk by preserving every existing valid bullet from the starting briefing and appending exactly one measured Census BDS bullet. The new bullet must mention:
   - `raw/census_bds/`
   - Census Business Dynamics Statistics
   - exact saved metadata and data filenames
   - row count excluding header
   - time coverage
   - geography level
   - main variables/fields
   - provider API caveats or dimension constraints
10. Copy the exact final briefing to `./dataset_briefing.md` and `$ARTIFACT_DIR/dataset_briefing.md`.
11. Write `improvement_result.json` with `status: "completed"`, measured BDS facts, `briefingBytes`, `profileReadbackVerified`, and `blocker: null`. Copy it to `$ARTIFACT_DIR`.
12. Before any profile update, run all guards below. If any guard fails, set `status: "blocked"` with the exact failed guard in `improvement_result.json`, copy artifacts, and stop.

```bash
! grep -q 'Startup placeholder\|startup_placeholder_not_final\|must be filled' dataset_briefing.md improvement_result.json
grep -q 'raw/census_bds/' dataset_briefing.md
grep -q 'Census Business Dynamics Statistics' dataset_briefing.md
grep -q 'raw/federal_reserve_z1/z1_csv_files_20260319.zip' dataset_briefing.md
grep -q 'raw/worldbank/WDI_CSV_2026_04_09.zip' dataset_briefing.md
grep -q 'raw/bis_cpmi/WS_CPMI_CASHLESS_csv_col.zip' dataset_briefing.md
```

13. Update the backend profile only after all guards pass.
14. Read the profile back and verify `briefingMarkdown` contains `raw/census_bds/`, preserves the three existing markers above, and has `volumeInventoryRunId` or `describedRunId` equal to this run id.
15. If readback does not prove the final profile, set `status: "blocked"` and explain the mismatch in `improvement_result.json`.

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
