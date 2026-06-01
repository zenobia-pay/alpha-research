# Improve Canonical Dataset: Econ (`econ`)

Improve this canonical dataset now.

Field brief:

```text
Focused canonical econ improvement: add official CFTC Commitments of Traders report-family breadth beyond the already-present disaggregated futures-only history.

Use only official CFTC historical compressed text ZIP URLs from https://www.cftc.gov/MarketReports/CommitmentsofTraders/HistoricalCompressed/index.htm.

Target mounted dataset directory:
/data/datasets/econ/raw/cftc_cot_broader_report_families_2020_2026/

Before writing, prove the mounted dataset root is writable with an actual create/delete probe under /data/datasets/econ/.

Fetch these provider-native ZIPs exactly, with `curl -L --fail --retry 3`, and preserve them compressed. Do not expand into many files except for streaming ZIP inventories/counts.

Families and URL templates:
1. Legacy futures-only reports: `https://www.cftc.gov/files/dea/history/deacot<YEAR>.zip`
2. Legacy futures-and-options combined reports: `https://www.cftc.gov/files/dea/history/deahistfo<YEAR>.zip`
3. Disaggregated futures-and-options combined reports: `https://www.cftc.gov/files/dea/history/com_disagg_txt_<YEAR>.zip`
4. Traders in Financial Futures futures-only reports: `https://www.cftc.gov/files/dea/history/fut_fin_txt_<YEAR>.zip`
5. Traders in Financial Futures futures-and-options combined reports: `https://www.cftc.gov/files/dea/history/com_fin_txt_<YEAR>.zip`
6. Commodity Index Trader supplement: `https://www.cftc.gov/files/dea/history/dea_cit_txt_<YEAR>.zip`

Years: 2020, 2021, 2022, 2023, 2024, 2025, 2026 where the official URL returns HTTP 200. If a year/family URL is not available, record the failed HTTP status in metadata and continue only if the available files still form a useful official public slice. Local probes on 2026-06-01 verified HTTP 200 for examples including `deacot2025.zip`, `deacot2024.zip`, `deahistfo2025.zip`, `fut_fin_txt_2025.zip`, `com_fin_txt_2025.zip`, and `com_disagg_txt_2025.zip`.

Required layout:
- One subdirectory per family: `legacy_futures_only`, `legacy_futures_options_combined`, `disaggregated_futures_options_combined`, `tff_futures_only`, `tff_futures_options_combined`, `cit_supplement`.
- Store provider ZIP files under those subdirectories using their original filenames.
- Write `metadata.json` at the target root with source page URL, retrieved_at, family/year URL list, HTTP status, Last-Modified and Content-Length when available, file bytes, SHA-256, ZIP member inventory, row counts excluding header for text members, total bytes, total files, and any failed URLs.
- Write `inventory.csv` at the target root with one row per successfully downloaded ZIP: family, year, filename, source_url, bytes, sha256, last_modified, zip_member_count, data_rows, field_count, first_header.
- Do not create merged panels, derived joins, normalized tables, or model-ready outputs.

Completion criteria before profile update:
- At least 30 ZIPs are successfully downloaded (6 families x 5+ years) and all pass ZIP integrity checks.
- `metadata.json` and `inventory.csv` exist and agree with the ZIP files.
- Existing CFTC disaggregated futures-only history under `raw/cftc_cot_disaggregated_history_2020_2025/` remains untouched.
- `dataset_briefing.md` and `improvement_result.json` are not startup placeholders.
- Backend profile readback contains the full accumulated econ inventory and current remote execution id.

If complete, add one literal inventory bullet for `raw/cftc_cot_broader_report_families_2020_2026/` describing the family/year coverage, file counts, rows, key fields, and caveats. Update the credit/banking/mortgages/financial-markets roadmap to say broader CFTC report families are now present in part. Preserve all existing econ inventory exactly. Do not claim all economics data is complete.
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

The startup `dataset_briefing.md` and `improvement_result.json` are blocked placeholders for artifact capture only. Do not update the backend dataset profile while either file still contains `Startup placeholder` or `startup_placeholder_not_final`. Before any profile update, run `grep -q 'Startup placeholder\\|startup_placeholder_not_final' dataset_briefing.md improvement_result.json` and block instead of syncing if it matches.

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

If any required step fails, write `improvement_result.json` with `"status": "blocked"` and explain the non-secret blocker. Do not update the backend profile on blocked runs unless the briefing is a real literal inventory and the result blocker is only profile API unavailability.

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
