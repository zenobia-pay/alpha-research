# Exact Econ Improvement: Finalize Existing Census BDS Bulk ZIP

You are running an admin-owned canonical dataset improvement for `econ`.

Objective: validate and inventory the existing provider-native Census Business Dynamics Statistics (BDS) bulk ZIP already present at `$DATASET_DIR/raw/census_bds/BDSTIMESERIES.zip`, then update the econ briefing/profile only if the full existing inventory is preserved.

Hard rules:

- Use the mounted canonical dataset directory for `econ`. Prefer `$DATASET_DIR`, then `$DATASET_MOUNT_PATH`, then `/data/datasets/econ`.
- Do not call Census API data endpoints in this run. The prior run already proved BDS API data calls require a real Census API key in this environment.
- Do not create derived analysis tables, merged panels, model-ready extracts, or cross-source joins.
- Do not replace the econ briefing with a one-source briefing.
- The final `dataset_briefing.md` must contain all three existing inventory markers:
  - `raw/federal_reserve_z1/z1_csv_files_20260319.zip`
  - `raw/worldbank/WDI_CSV_2026_04_09.zip`
  - `raw/bis_cpmi/WS_CPMI_CASHLESS_csv_col.zip`
- The final `dataset_briefing.md` must contain a measured BDS bullet for `raw/census_bds/BDSTIMESERIES.zip`.
- If you cannot prove the ZIP exists and inspect it directly, block. If you cannot obtain a starting full briefing containing the three markers above, block.

Required first commands:

```bash
RUN_ID="${REMOTE_AGENT_EXECUTION_ID:-${RUN_ID:-}}"
if [ -z "$RUN_ID" ] && [ -f run_config.json ]; then RUN_ID="$(node -e "const c=require('./run_config.json'); console.log(c.remoteAgentExecutionId||c.executionId||c.runId||'')" 2>/dev/null || true)"; fi
if [ -z "$RUN_ID" ]; then RUN_ID="$(basename "$PWD")"; fi
DATASET_DIR="${DATASET_DIR:-${DATASET_MOUNT_PATH:-/data/datasets/econ}}"
ARTIFACT_DIR="${ARTIFACT_DIR:-/results/$RUN_ID}"
mkdir -p "$ARTIFACT_DIR"
printf '# Work Log\n\nStarted exact Census BDS ZIP finalization.\n' > work.md
printf '<!doctype html><title>Census BDS ZIP finalization</title><h1>Census BDS ZIP finalization</h1>\n' > report.html
printf '# Data Inventory\n- Startup placeholder: BDS ZIP has not yet been validated in this run.\n' > dataset_briefing.md
cat > improvement_result.json <<JSON
{"status":"blocked","blocker":"not_completed_yet","datasetId":"econ","runId":"$RUN_ID","briefingBytes":$(wc -c < dataset_briefing.md),"profileReadbackVerified":false}
JSON
cp work.md report.html dataset_briefing.md improvement_result.json "$ARTIFACT_DIR"/
```

Required work:

1. Verify `$DATASET_DIR` exists and is writable using an actual create/delete probe, not only `test -w`: `probe="$DATASET_DIR/.canonical_write_probe_$RUN_ID"; printf ok > "$probe" && rm "$probe"`. If this fails, write a blocked result with the non-secret filesystem error, copy artifacts, and stop.
2. Verify `$DATASET_DIR/raw/census_bds/BDSTIMESERIES.zip` exists and is readable. If missing, block with `missing_raw_census_bds_zip`.
3. Inspect `BDSTIMESERIES.zip` directly with standard ZIP tooling. Record:
   - ZIP byte size
   - member filenames
   - primary data member name
   - row count excluding header
   - year range
   - field names
   - whether rows are BDS time-series observations
4. Obtain the starting full econ briefing from the backend dataset profile, not from a stale local `dataset/dataset_briefing.md` file. Use the authenticated session available in the worker to GET `/api/cli/datasets/econ`; extract `dataset.profile.briefingMarkdown`. If backend read fails, you may use `$DATASET_DIR/dataset_briefing.md` only if it contains all three required existing markers.
5. If the starting briefing does not contain all three existing markers, block with `missing_full_starting_briefing`; do not update the backend profile.
6. Append exactly one measured BDS bullet to the starting briefing unless it already contains a `raw/census_bds/BDSTIMESERIES.zip` bullet, in which case replace only that BDS bullet with the newly measured facts.
7. The BDS bullet must mention:
   - `raw/census_bds/BDSTIMESERIES.zip`
   - Census Business Dynamics Statistics (BDS)
   - exact ZIP member names
   - row count excluding header
   - year range
   - main fields
   - caveat that API data requests required a Census API key in this environment, so this run inventories the provider-native bulk ZIP already present on the canonical volume
8. Write the final briefing to `$DATASET_DIR/dataset_briefing.md`, `./dataset_briefing.md`, and `$ARTIFACT_DIR/dataset_briefing.md`.
9. Update or append `raw_inventory.*`, `download_inventory.*`, `source_registry.*`, `quality_report.md`, `data_dictionary.md`, and `manifest.json` if they exist and can be safely updated. Do not block only because optional inventory files are absent.
10. Write `improvement_result.json` with `status: "completed"`, measured BDS facts, `briefingBytes`, `profileReadbackVerified: false`, and `blocker: null`. Copy it to `$ARTIFACT_DIR`.
11. Before any profile update, run all guards below. If any guard fails, set `status: "blocked"` with the exact failed guard in `improvement_result.json`, copy artifacts, and stop.

```bash
! grep -q 'Startup placeholder\|startup_placeholder_not_final\|must be filled' dataset_briefing.md improvement_result.json
grep -q 'raw/census_bds/BDSTIMESERIES.zip' dataset_briefing.md
grep -q 'Census Business Dynamics Statistics' dataset_briefing.md
grep -q 'raw/federal_reserve_z1/z1_csv_files_20260319.zip' dataset_briefing.md
grep -q 'raw/worldbank/WDI_CSV_2026_04_09.zip' dataset_briefing.md
grep -q 'raw/bis_cpmi/WS_CPMI_CASHLESS_csv_col.zip' dataset_briefing.md
```

12. Update the backend profile only after all guards pass:
   - `briefingMarkdown`: exact final `dataset_briefing.md`
   - `profile.quality.diskInventoryProven`: `true`
   - `profile.quality.volumeInventoryRunId`: current run id
   - `profile.quality.volumeInventoryUpdatedAt`: current ISO timestamp
   - `describedRunId`: current run id
   - `describedAt`: current ISO timestamp
13. Read the backend profile back and verify `briefingMarkdown` contains `raw/census_bds/BDSTIMESERIES.zip`, preserves all three existing markers, and has `volumeInventoryRunId` or `describedRunId` equal to this run id.
14. Rewrite `improvement_result.json` with `profileReadbackVerified: true` only after readback proves the profile. Copy final artifacts again.

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
