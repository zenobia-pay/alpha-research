# Improve Canonical Dataset: Econ (`econ`)

Improve this canonical dataset now.

Field brief:

```text
# Econ HMDA 2021 Snapshot Prompt

Dataset id: `econ`

Objective: Improve the canonical econ dataset by adding the official FFIEC/CFPB HMDA Snapshot National Loan-Level Dataset package for 2021. This extends the existing HMDA 2022-2024 coverage backward one more year.

This is an admin-owned canonical dataset improvement job. Do not start a user-facing research run.

## Current State

The econ dataset is currently CLI-visible as `disk_proven`, writable, and profile-backed by the full checked-in briefing. Existing HMDA coverage already includes:

- `raw/hmda_2024_snapshot/`
- `raw/hmda_2023_snapshot/`
- `raw/hmda_2022_snapshot/`

HMDA 2021 and earlier snapshots remain documented gaps.

## Official Target URLs

Download only these official FFIEC/CFPB provider ZIPs:

- `https://files.ffiec.cfpb.gov/static-data/snapshot/2021/2021_public_lar_csv.zip`
- `https://files.ffiec.cfpb.gov/static-data/snapshot/2021/2021_public_ts_csv.zip`
- `https://files.ffiec.cfpb.gov/static-data/snapshot/2021/2021_public_msamd_csv.zip`

Local preflight on 2026-06-02 verified all three URLs with HTTP 200 HEAD responses. The LAR ZIP is large, about 1,517,879,241 bytes, so preserve it compressed and do not extract the full CSV.

## Required Work

1. Resolve the mounted dataset directory from `DATASET_MOUNT_PATH` or the canonical dataset mount for `econ`.
2. Prove actual write access with a create/delete probe in the dataset root before any downloads.
3. Check inode and disk capacity before downloading. If capacity is unsafe for a 1.52 GB ZIP plus small companions and metadata, stop with a blocked result before downloading.
4. Create `raw/hmda_2021_snapshot/`.
5. Download the three official provider ZIP files into `raw/hmda_2021_snapshot/`.
6. Validate each downloaded ZIP:
   - HTTP 200 source evidence;
   - nonzero byte size matching the saved file;
   - SHA-256 hash;
   - ZIP signature/integrity check;
   - member names;
   - uncompressed byte size per CSV member if feasible without full extraction.
7. For the LAR ZIP, do not fully extract the CSV. Inspect the ZIP central directory and, if feasible, stream/read only the CSV header plus a few sample lines. Avoid creating many filesystem entries.
8. Regenerate mounted metadata/inventory files from current disk state, including at least:
   - `manifest.json`
   - `source_registry.csv`
   - `source_registry.plan.json`
   - `raw_inventory.jsonl`
   - `raw_inventory.csv`
   - `volume_inventory.jsonl`
   - `volume_inventory.csv`
   - `volume_inventory_summary.json`
   - `volume_tree.txt`
9. Preserve the full existing econ briefing. Add exactly one conservative `raw/hmda_2021_snapshot/` bullet only if real files land. Do not replace the broad inventory with an HMDA-only briefing.
10. The final briefing, docs mirrors, and backend profile must still include these broad inventory markers:
    - `raw/federal_reserve_z1/z1_csv_files_20260319.zip`
    - `raw/worldbank/WDI_CSV_2026_04_09.zip`
    - `raw/bis_cpmi/WS_CPMI_CASHLESS_csv_col.zip`
    - `raw/hmda_2022_snapshot/`
    - `raw/hmda_2023_snapshot/`
    - `raw/hmda_2024_snapshot/`
    - `raw/sec_edgar_bulk/`
    - `raw/cfpb_complaints/complaints.csv.zip`
11. Update:
    - `docs/public-datasets/briefings/econ.md`
    - `docs/public-datasets/econ.mdx`
    - backend dataset profile via `update_remote_dataset_profile`
12. Read back the backend profile and verify:
    - `diskInventoryProven` is true;
    - profile proof uses the current execution id;
    - `briefingMarkdown` is not a startup placeholder;
    - HMDA 2021, 2022, 2023, and 2024 markers are all present;
    - the broad inventory markers listed above are still present.

## Required Final Artifacts

Produce all required canonical improvement artifacts, including:

- `dataset_briefing.md`
- `improvement_result.json`
- `work.md`
- `report.html`
- `manifest.json`
- `source_registry.csv`
- `source_registry.plan.json`
- `raw_inventory.jsonl`
- `raw_inventory.csv`
- `volume_inventory.jsonl`
- `volume_inventory.csv`
- `volume_inventory_summary.json`
- `volume_tree.txt`
- docs mirrors

The final `dataset_briefing.md`, docs mirrors, `improvement_result.json`, and backend profile must not contain `Startup placeholder` or `startup_placeholder_not_final`.

## Blockers

If no valid HMDA 2021 ZIP lands, do not promote a placeholder. Write a blocked `improvement_result.json` with attempted URLs, statuses, and non-secret errors.

If final profile readback cannot be verified, preserve the full prior checked-in briefing in the final artifacts and mark the run blocked rather than overwriting the profile with a narrow or placeholder briefing.

## Reporting

Report:

- execution id;
- saved directory;
- downloaded filenames;
- HTTP status, byte size, SHA-256, and ZIP member evidence;
- whether the final profile readback was verified;
- remaining HMDA gaps, especially 2020 and earlier snapshots, dynamic API slices, documentation breadth, and restricted mortgage/credit datasets.

Do not claim the econ dataset now has literally all data an economist could need; this is one concrete gap narrowed.
```

## First Action

Before planning or doing any dataset work, create these non-empty runtime files in the current working directory:

- `work.md`
- `report.html`

Use any valid starter content, for example:

```bash
printf '# Work Log\n\nStarted canonical improvement run.\n' > work.md
printf '<!doctype html><title>Canonical improvement run</title><h1>Canonical improvement run started</h1>\n' > report.html
printf '# Data Inventory\n- Startup placeholder: no validated improvement has been completed yet in this run.\n' > dataset_briefing.md
cat > improvement_result.json <<'JSON'
{
  "status": "blocked",
  "blocker": "startup_placeholder_not_final",
  "briefingBytes": 0,
  "profileReadbackVerified": false
}
JSON
```

If a results directory exists, also copy all four startup files there: `work.md`, `report.html`, `dataset_briefing.md`, and `improvement_result.json`. If no run id or results directory is available, continue anyway. Do not block only because the run id is unavailable.

The admin validator reads the remote execution artifact list, not just the mounted dataset volume. Files written only under the dataset mount do not satisfy validation. Before final response, every required output file listed below must exist in the current working directory. Also mirror `work.md`, `report.html`, `improvement_result.json`, and `dataset_briefing.md` into any writable `/results/<run-id>/` or current run result directory you can find. If you write `dataset_briefing.md` on the mounted dataset volume first, copy the exact same bytes back to `./dataset_briefing.md` and the results directory.

The startup `dataset_briefing.md` and `improvement_result.json` are blocked placeholders for artifact capture only. They must never be the final `dataset_briefing.md`, final `improvement_result.json`, docs mirror, or backend profile body. If any step blocks after startup, first recover the current full briefing from `$DATASET_DIR/dataset_briefing.md`, `dataset/docs/public-datasets/briefings/econ.md`, or the backend dataset profile, copy that full briefing to `./dataset_briefing.md` and the results directory, then write `improvement_result.json` with `"status": "blocked"` and the non-secret blocker. Do not update the backend dataset profile while either file still contains `Startup placeholder` or `startup_placeholder_not_final`. Before any profile update, run `grep -q 'Startup placeholder\\|startup_placeholder_not_final' dataset_briefing.md improvement_result.json` and block instead of syncing if it matches.

## Goal

Add or repair a small, high-value slice of public-source raw data that improves coverage, freshness, provenance, or usability for `econ`.

Preserve source data as close to provider format as practical. Do not build merged panels, joined analysis tables, model-ready features, or opinionated metrics.

## Required Work

1. Inspect the mounted dataset volume and existing inventories. Before any download or dataset mutation, prove the mount is writable with an actual create/delete probe inside the dataset root, for example `probe="$DATASET_DIR/.canonical_write_probe_$RUN_ID"; printf ok > "$probe" && rm "$probe"`. Do not rely on `test -w` alone; if the probe fails, block with `dataset_dir_not_writable` or the exact non-secret filesystem error.
2. Choose one focused improvement that can be completed in this run.
3. Fetch or repair public-source raw data, documentation, or metadata for that improvement.
4. Record provenance: source URL, access time, license/access notes, file paths, and any failed attempts.
5. Regenerate final inventories from the dataset volume after the improvement.
6. Rewrite `dataset_briefing.md` as a literal inventory of data actually on disk.
7. Copy the same briefing body to:
   - `docs/public-datasets/briefings/econ.md`
   - `docs/public-datasets/econ.mdx`
8. Update the backend dataset profile from the exact briefing body:
   - `briefingMarkdown`: exact `dataset_briefing.md` contents
   - `profile.quality.diskInventoryProven`: `true`
   - `profile.quality.volumeInventoryRunId`: current remote execution id
   - `profile.quality.volumeInventoryUpdatedAt`: current ISO timestamp
   - `describedRunId`: current remote execution id
   - `describedAt`: current ISO timestamp
9. Read the backend profile back and verify it contains the exact briefing and current remote execution id.

## Required Output Files

Write these files before final response:

- `work.md`
- `report.html`
- `improvement_plan.md`
- `improvement_result.json`
- `candidate_sources.csv`
- `exa_search_log.json`
- `manifest.json`
- `source_registry.csv`
- `source_registry.plan.json`
- `download_inventory.jsonl`
- `download_inventory.csv`
- `download_events.jsonl`
- `slack_download_alerts.jsonl`
- `slack_briefing.md`
- `raw_inventory.jsonl`
- `raw_inventory.csv`
- `volume_inventory.jsonl`
- `volume_inventory.csv`
- `volume_inventory_summary.json`
- `volume_tree.txt`
- `data_dictionary.md`
- `quality_report.md`
- `dataset_briefing.md`
- `docs/public-datasets/briefings/econ.md`
- `docs/public-datasets/econ.mdx`

Also copy `work.md`, `report.html`, `improvement_result.json`, and `dataset_briefing.md` into the run results/artifact directory when it is available. Do not send the final response until `ls -l work.md report.html improvement_result.json dataset_briefing.md` succeeds in the current working directory.

## Briefing Rules

`dataset_briefing.md` must start with:

```md
# Data Inventory
```

Every bullet must describe concrete data present on disk: file or table, what records represent, grain, geography, time coverage, row/object counts when measurable, important fields, units, and caveats. Do not describe hoped-for data.

## Completion Rules

Final status is `completed` only if:

- `dataset_briefing.md` is non-empty.
- `improvement_result.json` is non-empty.
- Neither file contains `Startup placeholder` or `startup_placeholder_not_final`.
- Backend profile readback confirms the exact briefing body.
- Backend profile readback references the current remote execution id.

If any required step fails, write `improvement_result.json` with `"status": "blocked"` and explain the non-secret blocker. On blocked runs, preserve the existing full dataset briefing as the final artifact instead of leaving the startup placeholder. Do not update the backend profile on blocked runs unless the briefing is a real literal inventory and the result blocker is only profile API unavailability.

Never print secret values. If checking whether a secret exists, print only `present` or `missing`.

## Final Response

Do not send the final response until `work.md`, `report.html`, `dataset_briefing.md`, and `improvement_result.json` have been written in the current working directory and copied to the run results/artifact directory when that directory exists, unless the run is blocked before dataset work can start. Even if blocked, keep `work.md` and `report.html` non-empty, and write `improvement_result.json` with `"status": "blocked"` whenever possible.

Return:

```md
status: completed|blocked
dataset_id: econ
run_id: <current remote execution id>
briefing_bytes: <bytes>
profile_readback_verified: true|false
blockers:
- <none or blocker>
```
