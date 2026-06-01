# Exact Econ Improvement: Read-Only BDS Profile Finalization

You are running an admin-owned canonical dataset improvement for `econ`.

Objective: inspect the existing provider-native Census Business Dynamics Statistics (BDS) bulk ZIP already present on the canonical volume, then update the backend profile and artifacts with a full inventory that preserves all existing econ sources and adds exactly one measured BDS bullet.

This run is intentionally read-only for the dataset volume because the prior finalization run proved `/data/datasets/econ` can fail writes with ENOSPC. Do not write to `/data/datasets/econ` in this run. Only read the existing ZIP and update worker artifacts plus the backend dataset profile.

Hard rules:

- Use the mounted canonical dataset directory for reads only. Prefer `$DATASET_DIR`, then `$DATASET_MOUNT_PATH`, then `/data/datasets/econ`.
- Do not call Census API data endpoints. Do not require a Census API key.
- Do not write, delete, rename, or touch files under `$DATASET_DIR`.
- Do not replace the econ briefing with a one-source briefing.
- Obtain the starting full econ briefing from the backend dataset profile via GET `/api/cli/datasets/econ`, not from local `dataset/dataset_briefing.md`.
- The starting and final briefing must contain these existing inventory markers:
  - `raw/federal_reserve_z1/z1_csv_files_20260319.zip`
  - `raw/worldbank/WDI_CSV_2026_04_09.zip`
  - `raw/bis_cpmi/WS_CPMI_CASHLESS_csv_col.zip`
- The final briefing must contain a measured BDS bullet for `raw/census_bds/BDSTIMESERIES.zip`.
- If the ZIP is missing/unreadable, or the backend starting briefing lacks any required marker, block and do not update the backend profile.

Required first commands:

```bash
RUN_ID="${REMOTE_AGENT_EXECUTION_ID:-${RUN_ID:-}}"
if [ -z "$RUN_ID" ] && [ -f run_config.json ]; then RUN_ID="$(node -e "const c=require('./run_config.json'); console.log(c.remoteAgentExecutionId||c.executionId||c.runId||'')" 2>/dev/null || true)"; fi
if [ -z "$RUN_ID" ]; then RUN_ID="$(basename "$PWD")"; fi
DATASET_DIR="${DATASET_DIR:-${DATASET_MOUNT_PATH:-/data/datasets/econ}}"
ARTIFACT_DIR="${ARTIFACT_DIR:-/results/$RUN_ID}"
mkdir -p "$ARTIFACT_DIR"
printf '# Work Log\n\nStarted read-only Census BDS profile finalization.\n' > work.md
printf '<!doctype html><title>Read-only Census BDS profile finalization</title><h1>Read-only Census BDS profile finalization</h1>\n' > report.html
printf '# Data Inventory\n- Startup placeholder: BDS ZIP has not yet been validated in this run.\n' > dataset_briefing.md
cat > improvement_result.json <<JSON
{"status":"blocked","blocker":"not_completed_yet","datasetId":"econ","runId":"$RUN_ID","briefingBytes":$(wc -c < dataset_briefing.md),"profileReadbackVerified":false,"volumeWriteMode":"read_only_due_to_prior_enospc"}
JSON
cp work.md report.html dataset_briefing.md improvement_result.json "$ARTIFACT_DIR"/
```

Required work:

1. Verify `$DATASET_DIR/raw/census_bds/BDSTIMESERIES.zip` exists and is readable. Do not write a probe file. If missing or unreadable, block with `missing_or_unreadable_raw_census_bds_zip`.
2. Inspect `BDSTIMESERIES.zip` directly with standard ZIP tooling. Record:
   - ZIP byte size
   - member filenames
   - primary data member name
   - row count excluding header
   - year range
   - field names
   - whether rows are BDS time-series observations
3. Read the backend dataset profile using the authenticated session available in the worker:
   - GET `/api/cli/datasets/econ`
   - extract `dataset.profile.briefingMarkdown`
   - extract current profile quality fields for notes
4. If the backend briefing does not contain all three existing inventory markers, block with `backend_profile_missing_existing_inventory_markers`; do not update the backend profile.
5. Append exactly one measured BDS bullet to the backend briefing unless it already contains a `raw/census_bds/BDSTIMESERIES.zip` bullet, in which case replace only that BDS bullet.
6. The BDS bullet must mention:
   - `raw/census_bds/BDSTIMESERIES.zip`
   - Census Business Dynamics Statistics (BDS)
   - exact ZIP member names
   - row count excluding header
   - year range
   - main fields
   - caveat that this run is read-only for the dataset volume because the prior write probe failed with ENOSPC, and inventories the provider-native ZIP already present on the canonical volume
7. Write the final briefing only to `./dataset_briefing.md` and `$ARTIFACT_DIR/dataset_briefing.md`. Do not write it to `$DATASET_DIR`.
8. Write `improvement_result.json` with `status: "completed"`, measured BDS facts, `briefingBytes`, `profileReadbackVerified: false`, `volumeWriteMode: "read_only_due_to_prior_enospc"`, and `blocker: null`. Copy it to `$ARTIFACT_DIR`.
9. Before any profile update, run all guards below. If any guard fails, set `status: "blocked"` with the exact failed guard in `improvement_result.json`, copy artifacts, and stop.

```bash
! grep -q 'Startup placeholder\|startup_placeholder_not_final\|must be filled' dataset_briefing.md improvement_result.json
grep -q 'raw/census_bds/BDSTIMESERIES.zip' dataset_briefing.md
grep -q 'Census Business Dynamics Statistics' dataset_briefing.md
grep -q 'raw/federal_reserve_z1/z1_csv_files_20260319.zip' dataset_briefing.md
grep -q 'raw/worldbank/WDI_CSV_2026_04_09.zip' dataset_briefing.md
grep -q 'raw/bis_cpmi/WS_CPMI_CASHLESS_csv_col.zip' dataset_briefing.md
```

10. Update the backend profile only after all guards pass:
   - `briefingMarkdown`: exact final `dataset_briefing.md`
   - `notes`: `Literal data inventory generated from verified mounted-volume inventories; read-only profile finalization for existing Census BDS ZIP after prior ENOSPC volume write blocker.`
   - `profile.quality.diskInventoryProven`: `true`
   - `profile.quality.volumeInventoryRunId`: current run id
   - `profile.quality.volumeInventoryUpdatedAt`: current ISO timestamp
   - `profile.quality.volumeWriteMode`: `read_only_due_to_prior_enospc`
   - `describedRunId`: current run id
   - `describedAt`: current ISO timestamp
11. Read the backend profile back and verify:
   - `briefingMarkdown` contains `raw/census_bds/BDSTIMESERIES.zip`
   - `briefingMarkdown` preserves all three existing markers
   - `volumeInventoryRunId` or `describedRunId` equals this run id
12. Rewrite `improvement_result.json` with `profileReadbackVerified: true` only after readback proves the profile. Copy final artifacts again.

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
