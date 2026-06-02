# Improve Canonical Dataset: Econ (`econ`)

Improve this canonical dataset now.

Field brief:

```text
# Econ Zillow Research Broader Housing Prompt

Dataset: `econ`
Timestamp: 2026-06-02T19:28:30Z

Objective: Improve the canonical econ dataset by adding a compact official Zillow Research public CSV package that broadens the current Zillow coverage beyond the existing metro single-family ZHVI seed.

Run this as an admin-owned canonical dataset improvement job. Work only through the mounted canonical dataset path for `econ`, preferably `DATASET_MOUNT_PATH`. Do not start a user-facing research run.

Target official Zillow Research public CSV URLs that were preflighted with HTTP 200 on 2026-06-02:

- `https://files.zillowstatic.com/research/public_csvs/zori/Metro_zori_uc_sfrcondomfr_sm_month.csv`
- `https://files.zillowstatic.com/research/public_csvs/zhvi/County_zhvi_uc_sfr_tier_0.33_0.67_sm_sa_month.csv`
- `https://files.zillowstatic.com/research/public_csvs/invt_fs/Metro_invt_fs_uc_sfrcondo_sm_month.csv`
- `https://files.zillowstatic.com/research/public_csvs/sales_count_now/Metro_sales_count_now_uc_sfrcondo_month.csv`

Requirements:

- Before downloads or profile work, prove the mounted dataset root is writable with an actual create/delete probe. If that fails, block with `dataset_dir_not_writable` or the exact non-secret filesystem error.
- Preserve raw provider-native files under a clear folder such as `raw/zillow_research_broader_20260602/`.
- Download only real Zillow CSV payloads from the official `files.zillowstatic.com/research/public_csvs/` URLs above. Do not use unofficial mirrors, browser automation workarounds, or scraped pages.
- For each file, record exact request URL, retrieval timestamp, HTTP status, content type, content length, Last-Modified, ETag, final saved byte size, SHA-256, row count, column count, identifier columns, date coverage, and geography level.
- Verify payloads are CSV data, not HTML/XML/JSON error pages or access-denied placeholders.
- Update mounted dataset inventory artifacts, manifest/source registry/download inventory/raw inventory/volume inventory where available.
- Write required artifacts: `dataset_briefing.md`, `improvement_result.json`, `work.md`, `report.html`, and `quality_report.md`.
- Update the CLI-visible backend profile from the final full `dataset_briefing.md`, and read it back to prove `diskInventoryProven: true`, the current execution id, no startup placeholder, and preservation of the existing econ inventory markers.
- Keep the final briefing conservative: add exactly one Zillow broader-housing bullet if valid files land. Preserve all prior econ source bullets and limitations. Do not claim full Zillow coverage; explicitly note that this remains a compact subset and that city/ZIP/rental/listing/market-heat/price-cut metrics and licensed real-estate datasets remain incomplete unless actually downloaded.

Hard stop: if any target URL fails, skip that file with evidence. If no valid Zillow CSV lands, do not promote a placeholder; write a blocked result with the attempted URLs and statuses.
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
