# Improve Canonical Dataset: Econ (`econ`)

Improve this canonical dataset now.

Field brief:

```text
Repair-focused canonical econ improvement for Census Building Permits Survey Master Data Set. The previous execution e0db054d-90af-498c-9e0e-1ee5b1cbc267 created /data/datasets/econ/raw/census_bps_master_202604/ and reported downloads, but `unzip -t /data/datasets/econ/raw/census_bps_master_202604/BPS_Compiled_File_202604.zip` failed. Treat the existing BPS files as untrusted until reverified.

Use only the mounted dataset root. Target directory:
/data/datasets/econ/raw/census_bps_master_202604/

Before repair, prove writability with a create/delete probe under /data/datasets/econ/.

Then inspect existing files with `ls -l`, `file`, `head -c 200` for the ZIP only if it appears non-binary/error-like, `wc -c`, and `sha256sum`. If the main ZIP is not exactly 458582881 bytes or `unzip -t` fails, remove only the three files in /data/datasets/econ/raw/census_bps_master_202604/ and redownload them with quoted URLs and explicit curl failure behavior:

curl -L --fail --retry 3 --retry-delay 5 --output "/data/datasets/econ/raw/census_bps_master_202604/BPS_Compiled_File_202604.zip" "https://www2.census.gov/econ/bps/Master%20Data%20Set/BPS_Compiled_File_202604.zip"
curl -L --fail --retry 3 --retry-delay 5 --output "/data/datasets/econ/raw/census_bps_master_202604/Compiled Data Documentation.docx" "https://www2.census.gov/econ/bps/Master%20Data%20Set/Compiled%20Data%20Documentation.docx"
curl -L --fail --retry 3 --retry-delay 5 --output "/data/datasets/econ/raw/census_bps_master_202604/Compiled File Sample.csv" "https://www2.census.gov/econ/bps/Master%20Data%20Set/Compiled%20File%20Sample.csv"

Hard gates before any profile/briefing update:
- `wc -c` for BPS_Compiled_File_202604.zip is exactly 458582881.
- `unzip -t /data/datasets/econ/raw/census_bps_master_202604/BPS_Compiled_File_202604.zip` exits 0.
- The DOCX and sample CSV are non-empty.
- Hashes and byte sizes are recorded.

If the gates fail, write blocked artifacts and do not update the backend profile or public briefing.

If the gates pass, record source URL, access time, byte size, SHA-256, ZIP member inventory, compressed/uncompressed sizes, and cheap streamed header/row counts for contained CSV members where feasible. Preserve the provider ZIP/DOCX/sample exactly; do not expand ZIP members to disk. Then update the full briefing, MDX mirror, manifest/profile/quality metadata, and artifacts. Add only a literal inventory bullet for raw/census_bps_master_202604/ and update the housing roadmap to say building permits are now present in part, while preserving all existing econ inventory and incomplete-gap caveats. Do not claim all economics data is complete.
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
