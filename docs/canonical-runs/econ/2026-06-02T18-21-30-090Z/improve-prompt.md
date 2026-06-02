# Improve Canonical Dataset: Econ (`econ`)

Improve this canonical dataset now.

Field brief:

```text
Canonical admin improvement job for dataset `econ`: add provider-native public Fannie Mae housing sentiment / National Housing Survey data.

This is an admin-owned canonical dataset improvement job, not a user-facing research analysis run. Operate on the mounted canonical dataset volume, preferably using `DATASET_MOUNT_PATH`, and perform an actual create/delete write probe in the dataset root before downloads. If the dataset root is not writable, stop with a precise non-secret blocker.

Goal:
- Fill part of the documented housing and real-estate gap for Fannie Mae surveys.
- Prefer official Fannie Mae National Housing Survey, Home Purchase Sentiment Index (HPSI), or related public housing-sentiment data downloads.
- Land a compact provider-native public source package that is useful for housing-demand, expectations, mortgage-credit, and consumer-sentiment research.

Target source:
- Official Fannie Mae Research / National Housing Survey / HPSI data page and direct public downloadable files.
- Capture the current public HPSI historical data file if available, plus methodology or data dictionary material needed to interpret the index and component questions.
- If the direct data file moved, use the current official Fannie Mae page to discover the public asset. If only a spreadsheet or PDF/document package is available, preserve it provider-native and document that format.

Constraints:
- Store raw provider files only under a clear folder such as `raw/fannie_mae_hpsi_<YYYYMMDD>/`.
- Do not create merged panels, derived variables, normalized tables, cross-source joins, regressions, or analysis-ready artifacts.
- Preserve provider filenames where practical.
- Capture source URLs, HTTP status, content type, content length when available, byte sizes, SHA-256 hashes, row/column counts where parseable, header names, date range, index/component fields, and access/usage notes.
- Do not use credentials, private endpoints, licensed products, or non-public data.

Required artifacts:
- `dataset_briefing.md` containing the full updated econ briefing, preserving prior documented sources and adding the new Fannie Mae housing-sentiment entry.
- `improvement_result.json` with execution id, dataset id, source classification, files landed, byte/hash evidence, and limitations.
- `quality_report.md` describing write probe result, source verification, inventory checks, and any blockers.
- A raw/download inventory artifact such as `raw_inventory.csv`, `download_inventory.csv`, or equivalent.
- `report.html` summarizing what changed.

Profile/docs expectations:
- Update the dataset profile/quality metadata so `canonical:dataset -- status --dataset-id econ` can show this execution as disk-inventory proof.
- The final status should be suitable for local validation with `npm run canonical:dataset -- validate --dataset-id econ --execution-id <execution-id>`: required runtime artifacts present, `diskInventoryProven` true, and profile readback tied to this execution id.
- Do not replace the existing broad econ briefing with a narrow Fannie Mae-only briefing. Preserve existing source bullets and limitations, and add/update only the relevant housing roadmap line.
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
