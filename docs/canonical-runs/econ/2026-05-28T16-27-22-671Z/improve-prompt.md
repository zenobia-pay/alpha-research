# Improve Canonical Dataset: Econ (`econ`)

Improve this canonical dataset now.

Field brief:

```text
# Data Inventory
- Federal Reserve Economic Data extracts for UNRATE, CPIAUCSL, FEDFUNDS, DGS10, and GDP: national monthly unemployment through 2026-04, monthly CPI through 2026-03, monthly effective federal funds rates through 2026-04, 16,787 business-day 10-year Treasury yields through 2026-05-07, and quarterly nominal GDP through 2026-01; each table stores one observation per date with values in percentages or billions of dollars as published by FRED.
- Federal Housing Finance Agency all-transactions house price index CSVs: 10,403 quarterly state-level index observations and 83,639 quarterly metro-level observations spanning 1975Q1–2025Q4 with index values only (no confidence intervals) for U.S. states and metro areas.
- Treasury Fiscal Data holdings: Debt to the Penny daily balances merged across API pages (8,303 rows covering 1993-04-01–2026-05-07 in USD) and Daily Treasury Statement operating cash balance accounts (10,000 rows for 2014-06-04–2026-05-07 with closing balances in millions), plus a consolidated Treasury par yield curve CSV with daily 1-month through 30-year constant maturity yields for 2024-01-02–2026-04-30.
- Bureau of Labor Statistics feeds: CPI-U all items JSON via the public API (120 monthly national observations for 2015-01–2026-04) and LAUS state unemployment JSON combining 51 series with monthly seasonally adjusted rates for 2019-01–2026-03.
- Census Building Permits Survey county tables: March 2026 current-month permits (`co2603c.txt`) and cumulative year-to-date permits (`co2603y.txt`) delivering 3,021 county-level records each with building counts, housing units, and permit valuation by structure size.
- Zillow Research city-level smoothed seasonally adjusted home value index matrix (license review): 21,410 locations with monthly typical home values from 2000-01 through 2026-03; redistribution awaits legal approval.
- Census Bureau microdata archives preserved as delivered ZIPs: ACS 2024 1-year PUMS (person and housing files at PUMA level), CPS January 2026 basic monthly file, and AHS 2023 national PUF (housing, person, weights, and codebooks).
- Bureau of Economic Analysis CAINC1 ZIP archive: annual state personal income tables covering 1969–2024 stored in provider ZIP packaging alongside layout documentation.
- Bank for International Settlements locational banking statistics bulk archive (license review): quarterly cross-border position CSVs through 2025Q4 for reporting and counterparty countries pending legal clearance.
- OECD composite leading indicator SDMX JSON payload for the United States (license review) containing annual indicator values through the 2026 release governed by OECD terms.
- National Bureau of Economic Research business cycle chronology HTML snapshot (license review) listing U.S. recession peaks and troughs through 2020 pending legal confirmation for redistribution.

```

## First Action

Before planning or doing any dataset work, create these non-empty runtime files in the current working directory:

- `work.md`
- `report.html`

Use any valid starter content, for example:

```bash
printf '# Work Log\n\nStarted canonical improvement run.\n' > work.md
printf '<!doctype html><title>Canonical improvement run</title><h1>Canonical improvement run started</h1>\n' > report.html
```

If a results directory exists, also copy both files there. If no run id or results directory is available, continue anyway. Do not block only because the run id is unavailable.

The admin validator reads the remote execution artifact list, not just the mounted dataset volume. Files written only under the dataset mount do not satisfy validation. Before final response, every required output file listed below must exist in the current working directory. Also mirror `work.md`, `report.html`, `improvement_result.json`, and `dataset_briefing.md` into any writable `/results/<run-id>/` or current run result directory you can find. If you write `dataset_briefing.md` on the mounted dataset volume first, copy the exact same bytes back to `./dataset_briefing.md` and the results directory.

## Goal

Add or repair a small, high-value slice of public-source raw data that improves coverage, freshness, provenance, or usability for `econ`.

Preserve source data as close to provider format as practical. Do not build merged panels, joined analysis tables, model-ready features, or opinionated metrics.

## Required Work

1. Inspect the mounted dataset volume and existing inventories.
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
- Backend profile readback confirms the exact briefing body.
- Backend profile readback references the current remote execution id.

If any required step fails, write `improvement_result.json` with `"status": "blocked"` and explain the non-secret blocker.

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
