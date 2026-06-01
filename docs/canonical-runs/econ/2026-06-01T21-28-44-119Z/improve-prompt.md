# Improve Canonical Dataset: Econ (`econ`)

Improve this canonical dataset now.

Field brief:

```text
Focused canonical econ improvement: add official Census County Business Patterns (CBP) 2023 downloadable CSV ZIP package to improve firm/industry/local establishment coverage beyond existing SUSB and QCEW slices.

Use only official Census Bureau CBP sources, starting from:
- `https://www.census.gov/programs-surveys/cbp/data/datasets.html`
- `https://www.census.gov/data/datasets/2023/econ/cbp/2023-cbp.html`

Census describes CBP datasets as downloadable CSV files from 1986 to the current reference year, with establishment counts, employment during the week of March 12, first-quarter payroll, and annual payroll tabulated by geography, industry detail, legal form where available, and establishment employment-size class. The 2023 dataset page was published June 26, 2025.

Target mounted dataset directory:
`/data/datasets/econ/raw/census_cbp_2023/`

Before writing, prove the mounted dataset root is writable with an actual create/delete probe under `/data/datasets/econ/`.

Fetch and preserve provider-native downloads exactly:
- 2023 U.S. file
- 2023 state file
- 2023 county file
- 2023 MSA file
- 2023 CSA file
- 2023 ZIP Code totals file
- 2023 ZIP Code industry detail file
- 2023 Puerto Rico & Island Areas file, if present
- 2023 county equivalents for Puerto Rico & Island Areas file, if present
- 2023 congressional district file, if present
- CBP record layouts and reference files linked from the official CBP dataset page, if present

Storage rules:
- Preserve provider ZIP/XLS/CSV files compressed/native under the target root, using original filenames where possible.
- Do not create merged panels, joins, normalized tables, or model-ready outputs.
- Stream ZIP/CSV inventories only for metadata: row counts excluding headers, column counts, first headers, member names, byte counts, SHA-256, HTTP status, Last-Modified/ETag/Content-Length when available.
- Write `metadata.json`, `inventory.csv`, and `source_notes.md` at the target root. `metadata.json` must include source landing URLs, retrieved_at, per-file URL, HTTP status, bytes, SHA-256, ZIP integrity status, row counts, field counts, and failed links.

Completion criteria before profile update:
- At least seven 2023 CBP data files are successfully preserved from official Census URLs.
- `metadata.json`, `inventory.csv`, and `source_notes.md` exist and agree with files on disk.
- Existing `raw/` directories remain untouched except the new target directory.
- `dataset_briefing.md` and `improvement_result.json` are not startup placeholders.
- Backend profile readback contains the full accumulated econ inventory and current remote execution id.

If complete, add one literal inventory bullet for `raw/census_cbp_2023/` describing file set, geographies, NAICS/industry detail, row counts, fields, measures, source pages, and caveats. Update the firm/industry/market-structure roadmap to say Census CBP 2023 is now present in part while historical CBP vintages and deeper firm microdata remain incomplete. Preserve all existing econ inventory exactly. Do not claim all economics data is complete.
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
