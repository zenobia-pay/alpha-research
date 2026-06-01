# Improve Canonical Dataset: Econ (`econ`)

Improve this canonical dataset now.

Field brief:

```text
# Improve Canonical Dataset: Econ (`econ`)

Focused canonical econ improvement: add official FFIEC/NIC holding-company financial report bulk downloads to close part of the roadmap's FR Y-9C holding-company reports gap.

Use only official FFIEC/NIC public sources, starting from `https://www.ffiec.gov/npw/FinancialReport/FinancialDataDownload`. That page states that quarterly files contain all variables reported at the time of the financial statements, are compressed TXT files selected by financial year and quarter, are caret-delimited after unzip, are refreshed daily around 5:00am EST Monday-Friday, and include FR Y-9C, FR Y-9LP, and FR Y-9SP data in one row per institution per quarter.

Target mounted dataset directory:
`/data/datasets/econ/raw/ffiec_nic_holding_company_financials_2020_2026/`

Before writing, prove the mounted dataset root is writable with an actual create/delete probe under `/data/datasets/econ/`.

Source and discovery requirements:
- Discover the official download mechanism from the NIC Financial Data Download page and its linked/scripts/network endpoints. Do not use unofficial mirrors.
- Capture the landing page HTML and any data dictionary workbook linked as "Financial Download Dictionary" when available.
- Download quarterly compressed TXT files for 2020 Q1 through the latest available 2026 quarter shown by the official source. If 2026 has only Q1 or no completed quarter, record that exactly and continue.
- If the source exposes report data only as one combined quarterly file for FR Y-9C/Y-9LP/Y-9SP, preserve that combined file; do not split it into report-specific derived outputs.
- If a year/quarter is unavailable or the official endpoint returns non-200, record the status and continue only if at least 20 quarterly files are successfully preserved.

Storage rules:
- Preserve provider-native compressed downloads under one subdirectory per year, using original or clearly source-derived filenames.
- Do not expand into many files except for streaming inventory, row counts, headers, and ZIP/TXT integrity checks.
- Write `metadata.json` at the target root with landing page URL, retrieved_at, discovered endpoint(s), per-quarter URL/request details, HTTP status, Last-Modified/ETag/Content-Length when available, file bytes, SHA-256, compression/member inventory, row counts excluding header, field counts, first header, and failed attempts.
- Write `inventory.csv` at the target root with one row per successful quarter: year, quarter, filename, source_url_or_endpoint, bytes, sha256, last_modified, rows, field_count, first_header.
- Write `source_notes.md` explaining the official source page, file format, report families included, refresh cadence, and limitations.
- Do not create merged panels, derived joins, normalized tables, model-ready outputs, or analysis metrics.

Completion criteria before profile update:
- At least 20 quarterly files successfully downloaded and all preserved provider-native.
- `metadata.json`, `inventory.csv`, and `source_notes.md` exist and agree with files on disk.
- Existing `raw/` directories remain untouched except the new target directory.
- `dataset_briefing.md` and `improvement_result.json` are not startup placeholders.
- Backend profile readback contains the full accumulated econ inventory and current remote execution id.

If complete, add one literal inventory bullet for `raw/ffiec_nic_holding_company_financials_2020_2026/` describing years/quarters, files, rows, field counts, included reports (FR Y-9C/Y-9LP/Y-9SP as applicable), source/dictionary coverage, and caveats. Update the credit/banking/mortgages/financial-markets roadmap to say FR Y-9C/holding-company financial files are now present in part. Preserve all existing econ inventory exactly. Do not claim all economics data is complete.
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
