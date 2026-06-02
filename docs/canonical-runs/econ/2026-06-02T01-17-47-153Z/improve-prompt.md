# Improve Canonical Dataset: Econ (`econ`)

Improve this canonical dataset now.

Field brief:

```text
Canonical admin improvement job for dataset `econ`: add one compact, high-value official/public BEA regional economics package that directly reduces the documented deeper regional accounts/local-area coverage gap.

Scope:
- This is an admin-owned canonical dataset improvement job, not a user-facing research analysis run.
- Use the mounted canonical dataset volume, preferably `DATASET_MOUNT_PATH`.
- Before downloads or profile edits, perform an actual create/write/delete probe in the dataset root. If the probe fails, stop and report `dataset_dir_not_writable` with the exact non-secret filesystem error.
- Target official/public U.S. Bureau of Economic Analysis regional data only. Prefer BEA Regional data ZIPs or direct CSV/TXT packages for county/local-area personal income, employment, GDP, or related regional tables from `apps.bea.gov` or `bea.gov`.
- Keep the job focused. Add one coherent provider-native package under `raw/bea_regional_local_area_<capture-date>/`.
- Do not use API keys, credentials, commercial mirrors, derived panels, joins, or model-ready transformations.

Storage and data rules:
- Preserve provider/source-native files where practical: ZIP, CSV, TXT, XLS/XLSX, PDF, HTML, or metadata snapshots.
- It is acceptable to create small metadata, inventory, source-summary, table-index, and file-level provenance files that make the source navigable.
- Do not create merged panels, cross-source joins, model-ready features, or analysis-ready regional indicators beyond faithful source inventories.

Required provenance:
- Record source URLs, final URLs after redirects, HTTP status, content type, Last-Modified/ETag when present, byte counts, SHA-256 hashes, retrieval timestamp, and provider/license/access notes.
- For each selected table/file, record what the records represent, geography, time coverage, frequency, row/column counts when measurable, key fields, units, and caveats.
- Record whether files are provider-native and what small helper files were generated.

Required artifacts:
- `dataset_briefing.md`: a full updated dataset inventory briefing that preserves all prior inventory bullets and adds the new BEA regional/local-area entry near the top.
- `improvement_result.json`: structured result with dataset id, raw directory, files, hashes, row counts, source URLs, license/access notes, and limitations.
- `raw_inventory.jsonl` and `raw_inventory.csv`: file-level inventory for the added package.
- `candidate_sources.csv`: include considered BEA regional/local-area pages/files and why the selected package was used.
- `work.md`: concise execution notes, including write-probe result.
- Updated docs mirrors for `docs/public-datasets/briefings/econ.md` and `docs/public-datasets/econ.mdx`.

Profile/readback:
- Update the canonical dataset profile/briefing to the full updated inventory, not a narrow briefing that drops older entries.
- Before profile update, verify `dataset_briefing.md` and `improvement_result.json` do not contain `Startup placeholder` or `startup_placeholder_not_final`.
- If the run blocks after startup, recover the existing full briefing and use it as final `dataset_briefing.md`; do not leave placeholder artifacts.
- Read the profile back after update and verify it remains `disk_proven`, `writeReady: true`, and tied to this execution id.
- Preserve roadmap limitation language. Mark BEA regional/local-area coverage as present in part only; do not claim full historical regional accounts, every BEA table, or complete microdata coverage.

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
