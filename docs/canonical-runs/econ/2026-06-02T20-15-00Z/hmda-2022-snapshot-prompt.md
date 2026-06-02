# Econ HMDA 2022 Snapshot Prompt

Dataset id: `econ`

Objective: Improve the canonical econ dataset by adding the official FFIEC/CFPB HMDA Snapshot National Loan-Level Dataset package for 2022. This extends the existing HMDA 2023-2024 coverage backward across more of the mortgage-rate cycle.

This is an admin-owned canonical dataset improvement job. Do not start a user-facing research run.

## Current State

The econ dataset is currently CLI-visible as `disk_proven`, writable, and profile-backed by the full checked-in briefing. Existing HMDA coverage already includes:

- `raw/hmda_2024_snapshot/`
- `raw/hmda_2023_snapshot/`

HMDA 2022 and earlier snapshots remain documented gaps.

## Official Target URLs

Download only these official FFIEC/CFPB provider ZIPs:

- `https://files.ffiec.cfpb.gov/static-data/snapshot/2022/2022_public_lar_csv.zip`
- `https://files.ffiec.cfpb.gov/static-data/snapshot/2022/2022_public_ts_csv.zip`
- `https://files.ffiec.cfpb.gov/static-data/snapshot/2022/2022_public_msamd_csv.zip`

Local preflight on 2026-06-02 verified all three URLs with HTTP 200 HEAD responses. The LAR ZIP is large, about 877,742,261 bytes, so preserve it compressed and do not expand it into many files.

## Required Work

1. Resolve the mounted dataset directory from `DATASET_MOUNT_PATH` or the canonical dataset mount for `econ`.
2. Prove actual write access with a create/delete probe in the dataset root before any downloads.
3. Check inode and disk capacity before downloading. If capacity is unsafe for an 878 MB ZIP plus small companions and metadata, stop with a blocked result before downloading.
4. Create `raw/hmda_2022_snapshot/`.
5. Download the three official provider ZIP files into `raw/hmda_2022_snapshot/`.
6. Validate each downloaded ZIP:
   - HTTP 200 source evidence;
   - nonzero byte size matching the saved file;
   - SHA-256 hash;
   - ZIP signature/integrity check;
   - member names;
   - uncompressed byte size per CSV member if feasible without full extraction.
7. For the LAR ZIP, do not fully extract the CSV. It is enough to inspect the ZIP central directory and, if feasible, stream/read just the CSV header plus a bounded line-count or metadata pass. Avoid creating millions of filesystem entries.
8. Regenerate the mounted metadata/inventory files from the current disk state, including at least:
   - `manifest.json`
   - `source_registry.csv`
   - `source_registry.plan.json`
   - `raw_inventory.jsonl`
   - `raw_inventory.csv`
   - `volume_inventory.jsonl`
   - `volume_inventory.csv`
   - `volume_inventory_summary.json`
   - `volume_tree.txt`
9. Preserve the full existing econ briefing. Add exactly one conservative `raw/hmda_2022_snapshot/` bullet only if real files land. Do not replace the broad inventory with an HMDA-only briefing.
10. The final briefing, docs mirrors, and backend profile must still include these existing broad inventory markers:
    - `raw/federal_reserve_z1/z1_csv_files_20260319.zip`
    - `raw/worldbank/WDI_CSV_2026_04_09.zip`
    - `raw/bis_cpmi/WS_CPMI_CASHLESS_csv_col.zip`
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
    - the HMDA 2022, 2023, and 2024 markers are all present;
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

If no valid HMDA 2022 ZIP lands, do not promote a placeholder. Write a blocked `improvement_result.json` with attempted URLs, statuses, and non-secret errors.

If final profile readback cannot be verified, preserve the full prior checked-in briefing in the final artifacts and mark the run blocked rather than overwriting the profile with a narrow or placeholder briefing.

## Reporting

Report:

- execution id;
- saved directory;
- downloaded filenames;
- HTTP status, byte size, SHA-256, and ZIP member evidence;
- whether the final profile readback was verified;
- remaining HMDA gaps, especially 2021 and earlier snapshots, dynamic API slices, documentation breadth, and restricted mortgage/credit datasets.

Do not claim the econ dataset now has literally all data an economist could need; this is one concrete gap narrowed.
