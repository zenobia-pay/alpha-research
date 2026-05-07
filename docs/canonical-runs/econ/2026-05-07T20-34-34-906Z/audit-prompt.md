# Canonical Dataset Disk Audit: Econ (`econ`)

Audit the mounted canonical dataset volume for `econ`. Do not fetch external sources and do not use private data.

## Goal

Make the dataset disk state knowable from machine-generated inventory files. The audit must prove what is physically on the mounted dataset volume and regenerate the dataset briefing and docs mirrors from that proof.

## Required Inputs To Inspect

- `DATASET_MOUNT_PATH`
- `MANIFEST_PATH` when present
- `./dataset` only if it resolves to the mounted dataset volume
- existing `download_inventory.*`
- existing `download_events.jsonl`
- existing `slack_download_alerts.jsonl`
- existing `slack_briefing.md`
- existing `raw_inventory.*`
- existing `volume_inventory.*`
- existing `dataset_briefing.md`
- existing `source_registry.*`
- existing `data_dictionary.md`
- existing `quality_report.md`

## Required Outputs

Write these files at the dataset root:

- `volume_inventory.jsonl`
- `volume_inventory.csv`
- `volume_inventory_summary.json`
- `volume_tree.txt`
- `download_events.jsonl`
- `slack_download_alerts.jsonl`
- `slack_briefing.md`
- `dataset_briefing.md`
- `quality_report.md`
- `docs/public-datasets/briefings/econ.md`
- `docs/public-datasets/econ.mdx`

## Download And Slack Audit Rules

Use `download_inventory.jsonl` / `.csv` as the source of truth for terminal download attempts already recorded on disk.

For every terminal attempt in `download_inventory.*`:

- ensure `download_events.jsonl` has at least a terminal event row (`succeeded`, `failed`, `blocked`, `skipped`, or `gated`) with dataset id, source id/name, redacted request URL, raw path, HTTP status, bytes, hash, and message;
- ensure `slack_download_alerts.jsonl` has one corresponding alert delivery row.

If a Slack alert row is missing and `CANONICAL_DATASET_SLACK_WEBHOOK_URL` is available, send a backfill Slack alert now and write `delivery_status: sent`. If the webhook is missing or delivery fails, write `delivery_status: pending` or `delivery_status: failed` with the non-secret reason. Never print or persist the webhook URL.

Write `slack_briefing.md` summarizing sent, pending, and failed Slack alerts.

## Volume Inventory Rules

Recursively inspect the mounted dataset volume after all writes. `volume_inventory.jsonl` is the source of truth for what is on disk and must include one row/object for every file.

Before final inventory, remove or avoid writing remote agent runtime/tooling/cache directories to the dataset volume when possible, including `.remote-agent`, `.codex`, `.cache`, temporary plugin caches, and local virtual environments. If they remain on disk, include them in the inventory with `source_family_guess: runtime_tooling` and report them as non-dataset contamination in `dataset_briefing.md` and `quality_report.md`.

For every file, capture:

- `dataset_id`
- `volume_mount_path`
- `relative_path`
- `absolute_path`
- `file_type`
- `extension`
- `size_bytes`
- `mtime`
- `sha256`
- `line_count` for text-like files when measurable
- `row_count` for CSV, TSV, JSONL, Parquet, DuckDB tables, or other readable tabular files when measurable
- `column_count` for tabular files when measurable
- `schema` for tabular files when measurable
- `detected_format`
- `is_required_artifact`
- `source_family_guess`
- `inventory_error`

If a file cannot be inspected, keep the row and set `inventory_error` to the exact error.

## Briefing Rules

Regenerate `dataset_briefing.md` only from `download_inventory.*`, `raw_inventory.*`, and `volume_inventory.*`.

The briefing must clearly state:

- what files are on disk and where;
- whether required canonical artifacts are present;
- exact source/data families that are physically represented;
- tabular schemas and row counts when measurable;
- unreadable files and inspection failures;
- whether this is raw data, source registry only, metadata/index package, normalized tables, or mixed;
- what is not present.
- whether every download attempt has both `download_inventory.*` coverage and `download_events.jsonl` coverage;
- whether every terminal download attempt has a sent, pending, or failed Slack alert row in `slack_download_alerts.jsonl`.

Mirror the final briefing into:

- `docs/public-datasets/briefings/econ.md`
- `docs/public-datasets/econ.mdx`

## Final Response

Return file count, total bytes, required artifacts missing, unreadable file count, and whether `diskInventoryProven` is true.
