# Improve Canonical Dataset: Econ (`econ`)

Improve this canonical dataset now.

Field brief:

```text
Focused canonical econ improvement: complete the missing U.S. Treasury Daily Treasury Statement deposits and withdrawals of operating cash raw FiscalData slice.

Use only the official FiscalData API endpoint:
https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/deposits_withdrawals_operating_cash

Target mounted dataset directory:
/data/datasets/econ/raw/treasury_fiscal_dts_operating_cash_20260601/

Before writing, prove the mounted dataset root is writable with an actual create/delete probe under /data/datasets/econ/.

Fetch provider-native CSV pages with these exact query parameters:
sort=-record_date&page[size]=10000&page[number]=<n>&format=csv
Use `curl -g -L --fail --retry 3 --compressed` because the query parameters include brackets.

Local verification on 2026-06-01:
- JSON metadata request with `page[size]=1&format=json` returned HTTP 200 and `meta.total-count = 469329`.
- Therefore full CSV pagination at page size 10000 is exactly 47 pages.
- Page 47 was locally verified as a short final page with 9,329 data rows plus header, ending at record_date 2005-10-03.
- Page 1 starts at record_date 2026-05-29.
- Header is `record_date,account_type,transaction_type,transaction_catg,transaction_catg_desc,transaction_today_amt,transaction_mtd_amt,transaction_fytd_amt,table_nbr,table_nm,src_line_nbr,record_fiscal_year,record_fiscal_quarter,record_calendar_year,record_calendar_quarter,record_calendar_month,record_calendar_day`.

Required data layout:
- Preserve all 47 raw API CSV responses under the target directory as `page_0001.csv` through `page_0047.csv`.
- Write `metadata.json` with endpoint URL, query template, retrieval timestamp, source metadata total-count/total-pages evidence, local page count, total rows, total bytes, SHA-256 over concatenated page bytes, first and final record dates, and header.
- Write `inventory.csv` with one row per page: page number, path, rows excluding header, bytes, SHA-256, first record_date, last record_date.
- Do not create derived panels, cross-source joins, feature tables, or model-ready outputs.

Completion criteria before profile update:
- Exactly 47 page CSV files exist.
- Total rows excluding headers equals 469,329.
- Page 47 has 9,329 rows excluding header.
- `metadata.json` and `inventory.csv` are present and agree with the page files.
- `dataset_briefing.md` and `improvement_result.json` are not startup placeholders.
- Backend profile readback contains the full accumulated econ inventory and current remote execution id.

Update the checked-in inventory docs only after those criteria are met. Add one literal inventory bullet for `raw/treasury_fiscal_dts_operating_cash_20260601/` describing the 47 raw CSV pages, 469,329 rows, date range, fields, and caveats. Update the public finance roadmap to say DTS operating-cash deposits/withdrawals are now present. Preserve all existing econ inventory exactly. Do not claim all economics data is complete.
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
