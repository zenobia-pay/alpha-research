# Canonical Public Dataset Build: Econ (`econ`)

You are building one canonical public Alpha Research dataset for this humanities or social-science field:

```text
Economics: macroeconomics, labor, housing, inflation, credit, consumer behavior, regional economics, and business-cycle research.
```

## Non-Negotiable Contract

- Public data only. Do not use private user data.
- This canonical dataset is a raw public source package, not an analysis-ready table bundle.
- Do not publish processed tables, merged panels, shared entity models, cross-source joins, derived fields, or analysis-ready outputs as canonical dataset artifacts.
- Keep each source in source-specific raw paths with provider-native files/API responses, codebooks, README files, schemas, and documentation.
- Skip or defer credentialed, paid, anti-bot protected, private, unstable, or unclear-access sources; record the exact blocker instead of failing the whole build.
- Never write secrets, cookies, bearer tokens, private credentials, presigned URLs, or API keys into logs, inventories, docs, or artifacts.

## Source Catalog

Use this starting source catalog. Verify every URL and classify each source before downloading:

```text
- Federal Reserve / FRED: https://fred.stlouisfed.org/
- U.S. Census Bureau data: https://www.census.gov/data.html
- American Community Survey: https://www.census.gov/programs-surveys/acs/data.html
- Current Population Survey: https://www.census.gov/programs-surveys/cps.html
- American Housing Survey: https://www.census.gov/programs-surveys/ahs.html
- BLS data portal: https://www.bls.gov/data/
- BLS CPI: https://www.bls.gov/cpi/
- BLS LAUS: https://www.bls.gov/lau/
- BEA data portal: https://www.bea.gov/data
- FHFA Home Price Index: https://www.fhfa.gov/data/hpi
- Zillow Research Data: https://www.zillow.com/research/data/
- NBER: https://www.nber.org/
```

## Required Dataset-Root Outputs

Write these exact files at the dataset root:

- `manifest.json`
- `source_registry.csv`
- `source_registry.plan.json`
- `download_inventory.jsonl`
- `download_inventory.csv`
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

## Download Logging

Record one row/object in `download_inventory.jsonl` and `download_inventory.csv` for every attempted source download, including failed, blocked, skipped, gated, and successful attempts.

Each download inventory record must include:

- `source_id`
- `source_name`
- `plain_english_description`
- `canonical_url`
- `request_url` with secrets redacted
- `retrieved_at`
- `retrieval_method`
- `http_status`
- `raw_path`
- `raw_format`
- `raw_bytes`
- `content_hash_sha256`
- `license`
- `access_status`
- `failure_or_gating_reason`

## Raw Inventory

Record one row/object in `raw_inventory.jsonl` and `raw_inventory.csv` for every raw source file, API response, document collection, codebook, schema file, README, or provider-native artifact that exists on disk.

Each raw inventory record must include:

- `raw_id`
- `source_id`
- `raw_path`
- `plain_english_description`
- `native_format`
- `native_schema_or_fields`
- `native_primary_keys`
- `native_time_coverage`
- `native_geography_or_topic_coverage`
- `row_document_or_object_count`
- `raw_bytes`
- `content_hash_sha256`
- `license`
- `access_status`
- `retrieved_at`
- `request_url`
- `quality_notes`

## Volume Inventory

After all writes are complete, recursively inspect the mounted dataset volume and write `volume_inventory.jsonl`, `volume_inventory.csv`, `volume_inventory_summary.json`, and `volume_tree.txt`.

`volume_inventory.jsonl` is the source of truth for what is on disk. It must contain one row/object for every file on the dataset volume.

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

## Briefing And Docs

Generate `dataset_briefing.md` only from `download_inventory.*`, `raw_inventory.*`, and `volume_inventory.*`. Do not infer volume contents from memory, the plan, or prior narratives.

The briefing must explain:

- what is physically on disk;
- top-level directory tree;
- source families present;
- exact raw files and API responses;
- exact docs, manifests, inventories, codebooks, and schema files;
- row/object counts and schemas when measurable;
- files that failed inspection;
- required artifacts present and missing;
- whether the dataset is raw data, source registry only, metadata/index package, normalized tables, or mixed;
- what is not present.

Mirror the final briefing into:

- `docs/public-datasets/briefings/econ.md`
- `docs/public-datasets/econ.mdx`

## CLI-Visible Profile Expectations

Make the final result and artifacts sufficient for the control plane to expose:

- `briefingMarkdown`
- `sources`
- `tables`
- `quality`
- `limitations`
- `volumeInventoryRunId`
- `volumeInventoryUpdatedAt`
- `diskInventoryProven: true`

If any required inventory is missing or incomplete, set `diskInventoryProven: false` in the structured result and explain why.

## Final Response

Return a concise summary with:

- dataset id/name;
- exact dataset volume path used;
- all required artifact paths written;
- file count and total bytes from `volume_inventory_summary.json`;
- required artifacts missing, if any;
- run status and whether `diskInventoryProven` is true.
