# Improve Canonical Dataset: Econ (`econ`)

Improve this canonical dataset now.

Field brief:

```text
Canonical admin improvement job for dataset `econ`: repair/add provider-native public Redfin Data Center housing-market data if currently available from official Redfin public download surfaces.

Goal:
- Narrow the documented housing and real-estate gap for Redfin public market data.
- Previous audit found `raw/redfin/redfin_market_trends.csv` was an S3 AccessDenied XML response, so do not promote that placeholder. Replace/repair only if a real public CSV can be fetched from official Redfin surfaces.
- Preserve raw provider-native public files only. Do not build merged panels, derived fields, joins, cleaned datasets, analysis-ready outputs, or synthetic replacements.

Target source family:
- Official Redfin Data Center pages and official public downloadable CSV/ZIP assets linked from them.
- Prefer compact stable public CSVs for market trends, city/county/metro/state housing market data, sale/list price, inventory, days on market, listings, pending sales, or similar Redfin Data Center measures.
- If the public data page moved, discover the current official Redfin URL and record redirects, HTTP status, content type, byte count, SHA-256, and final URL.
- If Redfin public files are blocked or no longer public, classify candidates as `deferred_fetchable`, `credential_required`, `license_review`, `not_found`, or `reject` with evidence, preserve the prior full briefing, and do not invent a substitute under the Redfin name.

Dataset/write constraints:
- Use the mounted canonical dataset directory from `$DATASET_MOUNT_PATH` or `/data/datasets/econ`.
- Before downloads, perform an actual create/delete write probe in the dataset root. `test -w` is not enough.
- Store new raw files only under a clear folder such as `raw/redfin_market_data_<YYYYMMDD>/` or repair `raw/redfin/` only if replacing an AccessDenied placeholder with real Redfin CSV data is safe and fully documented.
- Keep archives compressed unless inspection requires streaming members; avoid expanding large archives into many small files.
- Never delete or overwrite existing provider-native raw data except to quarantine/replace the known Redfin AccessDenied placeholder with clear audit evidence.

Required deliverables/artifacts:
- `work.md`: non-empty chronological work log.
- `report.html`: concise HTML report.
- `improvement_result.json`: top-level `status` exactly `completed` or `blocked`, with source classification, URLs attempted, file paths, byte counts, SHA-256 hashes, row/column/time/geography coverage where feasible, and blockers if any.
- `dataset_briefing.md`: the full updated econ briefing, preserving prior documented sources and adding a Redfin entry only if real public files were landed.
- Inventory artifacts such as `raw_inventory.csv`, `raw_inventory.jsonl`, `download_inventory.csv`, `download_inventory.jsonl`, and `quality_report.md` where feasible.
- Slack/lifecycle artifact(s) if webhook delivery is unavailable or fails, without exposing secrets.

Briefing/profile rules:
- Do not replace the existing broad econ briefing with a narrow Redfin-only briefing.
- Preserve existing inventory markers including `raw/federal_reserve_z1/z1_csv_files_20260319.zip`, `raw/worldbank/WDI_CSV_2026_04_09.zip`, `raw/bis_cpmi/WS_CPMI_CASHLESS_csv_col.zip`, `raw/fannie_mae_hpsi_20260602/`, `raw/apartment_list_rents_20260602/`, and `raw/zillow_research_20260602/`.
- If data lands, update the full mounted briefing, docs mirrors if accessible, manifest/profile/quality metadata, and backend profile proof fields with the current execution id.
- Before profile sync, block if `dataset_briefing.md` or `improvement_result.json` contains `Startup placeholder` or `startup_placeholder_not_final`.
- Read the backend profile back and verify it contains the exact updated full briefing and current execution id.
- If validation, profile sync, or readback cannot be proven, mark blocked and preserve the previous full briefing rather than syncing a narrowed or placeholder profile.

Roadmap wording:
- If Redfin public data lands, update housing roadmap coverage to say Redfin Data Center is present in part while keeping remaining gaps such as Case-Shiller, NAR, Freddie Mac AIMI, broader Zillow metrics/geographies, Fannie Mae survey microdata, parcel/assessor data, listings, appraisals, loan-level agency performance data, and licensed datasets explicit.
- If Redfin remains blocked, keep Redfin as absent and record the exact non-secret blocker in the maintenance summary.
- Do not claim the econ dataset now literally has all data an economist could need.
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
