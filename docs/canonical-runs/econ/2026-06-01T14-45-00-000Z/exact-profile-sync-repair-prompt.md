# Econ Profile Sync Repair: Full Inventory Proof

You are running an admin-owned canonical dataset maintenance job for `econ`.

Objective: repair canonical profile proof after recent source-ingestion jobs landed useful data but failed validation because the promoted primary briefing or backend profile readback was stale. Do not download or add new source data in this run.

Why this job:

- The checked-in public briefing now contains the full accumulated econ inventory, including CFTC COT, ALFRED snapshots, IRS SOI, and FAOSTAT.
- Recent worker executions reached `ready`, but canonical validation blocked because either `dataset_briefing.md` omitted an existing marker or the backend profile still pointed to `4822354c-5587-421f-b0e6-b8616d6c6e99`.
- Future economist-coverage additions need a reliable full-inventory baseline before more source downloads.

Dataset and storage constraints:

- Use the mounted dataset directory from `$DATASET_DIR`, `$DATASET_MOUNT_PATH`, or `/data/datasets/econ`.
- Before writing, record `df -i "$DATASET_DIR"` and `df -h "$DATASET_DIR"`.
- Perform a real write/delete probe in the dataset root. If it fails, block as `dataset_dir_not_writable` with the exact non-secret filesystem error.
- Do not delete, rename, download, or modify any provider-native raw source files.
- Do not touch `.remote-agent/runs`.
- Keep writes scoped to the profile/briefing/docs artifacts listed below.

Required repair work:

1. Read the full docs briefing at `docs/public-datasets/briefings/econ.md` on the dataset volume.
2. Verify it contains all required existing markers:
   - `raw/federal_reserve_z1/z1_csv_files_20260319.zip`
   - `raw/worldbank/WDI_CSV_2026_04_09.zip`
   - `raw/bis_cpmi/WS_CPMI_CASHLESS_csv_col.zip`
   - `raw/irs_soi/zipcode2022.zip`
   - `raw/cftc_cot/fut_disagg_txt_2026.zip`
   - `raw/alfred/GDP_alfred.csv`
   - `raw/faostat/Production_Crops_Livestock_E_All_Data_Normalized.zip`
3. Copy the full docs briefing verbatim to `dataset_briefing.md`.
4. Ensure `docs/public-datasets/econ.mdx` also contains the FAOSTAT bullet and the required existing markers.
5. Write `improvement_result.json` with `status: "completed"` only if the full briefing copy and marker checks pass. Otherwise write `status: "blocked"` and exact non-secret blockers.
6. Write `work.md` and `report.html` describing this as a profile-sync repair with no new source ingestion.
7. Attempt to update the backend dataset profile by POSTing the exact full `dataset_briefing.md` text to `POST /api/cli/datasets/econ/profile` if authenticated profile update is available in the worker.
8. Read back `GET /api/cli/datasets/econ` and verify:
   - `briefingMarkdown` contains the full updated inventory and every marker listed above;
   - `profile.quality.diskInventoryProven` is `true`;
   - `profile.quality.volumeInventoryRunId` equals this execution id;
   - `describedRunId` equals this execution id.
9. If profile update/readback fails, record the exact non-secret failure in `improvement_result.json`; still promote the full local artifacts so an external orchestrator can complete the profile sync.

Required output artifacts:

- `work.md`
- `report.html`
- `dataset_briefing.md`
- `improvement_result.json`
- `docs/public-datasets/briefings/econ.md`
- `docs/public-datasets/econ.mdx`

`improvement_result.json` must include:

- `status`: `completed` or `blocked`
- `datasetId`: `econ`
- `source`: `profile-sync-repair`
- `pathAdded`: `null`
- `markersVerified`
- `beforeDfInodes`
- `afterDfInodes`
- `profileUpdated`
- `profileReadbackVerified`
- `blockers`
- `recommendedNextAction`

Final response must be exactly:

```md
status: completed|blocked
dataset_id: econ
run_id: <run id>
source: profile-sync-repair
path_added: none
profile_updated: true|false
recommended_next_action: <one line>
```
