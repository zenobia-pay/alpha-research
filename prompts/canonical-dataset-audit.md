# Canonical Dataset Disk Audit: {datasetName} (`{datasetId}`)

Audit the mounted canonical dataset volume for `{datasetId}`. Do not fetch external sources and do not use private data.

## Goal

Make the dataset disk state knowable from machine-generated inventory files. The audit must prove what is physically on the mounted dataset volume and regenerate the dataset briefing and docs mirrors from that proof.

## Required Inputs To Inspect

- `DATASET_MOUNT_PATH`
- `MANIFEST_PATH` when present
- `./dataset` only if it resolves to the mounted dataset volume
- existing `download_inventory.*`
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
- `dataset_briefing.md`
- `docs/public-datasets/briefings/{datasetId}.md`
- `docs/public-datasets/{datasetId}.mdx`

## Volume Inventory Rules

Recursively inspect the mounted dataset volume after all writes. `volume_inventory.jsonl` is the source of truth for what is on disk and must include one row/object for every file.

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

Mirror the final briefing into:

- `docs/public-datasets/briefings/{datasetId}.md`
- `docs/public-datasets/{datasetId}.mdx`

## Final Response

Return file count, total bytes, required artifacts missing, unreadable file count, and whether `diskInventoryProven` is true.
