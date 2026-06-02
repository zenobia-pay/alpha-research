# Improve Canonical Dataset: Econ (`econ`)

Improve this canonical dataset now.

Field brief:

```text
Canonical admin repair job for dataset `econ`: validate and promote the already-downloaded BEA regional/local-area package by regenerating a full inventory briefing that preserves every existing econ inventory entry.

Scope:
- This is an admin-owned canonical dataset repair job, not a user-facing research analysis run.
- Use the mounted canonical dataset volume, preferably `DATASET_MOUNT_PATH`.
- Before any mutation or profile edit, perform an actual create/write/delete probe in the dataset root. If the probe fails, stop and report `dataset_dir_not_writable` with the exact non-secret filesystem error.
- Do not redownload BEA data unless the files are missing or corrupt. The prior run `00486c4b-5624-4e6e-88ee-a868a74101a9` indicated the package is already on disk under `raw/bea_regional_local_area_20260602/`.
- Inspect and verify only the existing BEA package, then rebuild the full `dataset_briefing.md`, docs mirrors, and backend profile from the complete current econ inventory.

Expected BEA package facts to verify from disk:
- `raw/bea_regional_local_area_20260602/CAINC30.zip`: expected size about 23,503,703 bytes; expected SHA-256 `29945d32e31ef53e03907d282016156bcb946705583a9f8790d687d7da1bba63`; expected member `CAINC30__ALL_AREAS_1969_2024.csv`; expected 73,811 rows x 64 columns; annual 1969-2024 local-area/county/MSA personal-income components in current dollars.
- `raw/bea_regional_local_area_20260602/CAEMP25N.zip`: expected size about 11,050,299 bytes; expected SHA-256 `b36723a57080fce5a1020e63f898f2ceaa35d06bb01a454d4f643722cf6dca6b`; expected member `CAEMP25N__ALL_AREAS_2001_2022.csv`; expected 104,878 rows x 30 columns; annual 2001-2022 county employment counts in persons.
- Existing metadata/inventory files may include `metadata.json`, `raw_inventory.csv`, `raw_inventory.jsonl`, `raw_inventory_summary.csv`, and `raw_inventory_summary.json`.

Hard preservation requirements:
- The final `dataset_briefing.md` must be the full current econ inventory plus one BEA regional/local-area bullet near the top. It must not be a narrow BEA-only or WDI-only briefing.
- The final briefing must contain these existing markers before any profile update:
  - `raw/federal_reserve_z1/z1_csv_files_20260319.zip`
  - `raw/worldbank/WDI_CSV_2026_04_09.zip`
  - `raw/bis_cpmi/WS_CPMI_CASHLESS_csv_col.zip`
  - `raw/ons_bop_iip_20260602`
  - `raw/sec_edgar_bulk`
- Before profile update, verify `dataset_briefing.md` and `improvement_result.json` do not contain `Startup placeholder` or `startup_placeholder_not_final`.
- `improvement_result.json` must use top-level `"status": "completed"` only after the full briefing, docs mirrors, and profile readback are proven. Use `"status": "blocked"` for any failure; never leave `"status": "in_progress"` in the final artifact.

Required artifacts:
- `dataset_briefing.md`: full updated inventory, preserving all prior bullets and adding the BEA regional/local-area entry.
- `improvement_result.json`: structured completed/blocked result with dataset id, raw directory, verified files, hashes, row counts, source URLs, license/access notes, limitations, profile readback status, and exact blockers if any.
- `raw_inventory.jsonl` and `raw_inventory.csv`: BEA package file-level inventory or copy from the verified package.
- `candidate_sources.csv`: explain that this is a repair/promotion run for the existing BEA package and note any BEA candidate links that remain pending.
- `work.md`: concise execution notes, including write-probe result and marker checks.
- Updated docs mirrors for `docs/public-datasets/briefings/econ.md` and `docs/public-datasets/econ.mdx`.

Profile/readback:
- Update the backend dataset profile from the exact final `dataset_briefing.md` body:
  - `briefingMarkdown`: exact final briefing
  - `profile.quality.diskInventoryProven`: `true`
  - `profile.quality.volumeInventoryRunId`: current remote execution id
  - `profile.quality.volumeInventoryUpdatedAt`: current ISO timestamp
  - `describedRunId`: current remote execution id
  - `describedAt`: current ISO timestamp
- Read the profile back after update and verify:
  - status is `disk_proven`
  - `writeReady` is true
  - profile run id equals the current execution id
  - briefing contains the BEA package marker and all existing required markers above

Slack/status:
- Keep any Slack briefing concise and non-secret. Do not include tokens, webhook URLs, auth headers, cookies, or secret material.
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
