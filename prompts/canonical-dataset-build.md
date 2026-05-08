# Canonical Public Dataset Build: {datasetName} (`{datasetId}`)

You are building one canonical public Alpha Research dataset for this humanities or social-science field:

```text
{fieldBrief}
```

## Non-Negotiable Contract

- Public data only. Do not use private user data.
- Use the mounted dataset volume as the dataset root. Prefer `DATASET_MOUNT_PATH` when set; otherwise use `/mnt/alpha-research/datasets/{datasetId}`. Do not write canonical artifacts under a local throwaway `dataset/` directory unless it is a symlink or bind mount to the mounted dataset volume.
- Before any fetch, verify the remote runner has an authenticated Codex CLI/session available. If Codex is not logged in, stop before downloads, write the exact blocker to the run result, and set `diskInventoryProven: false`.
- Before any fetch, check `CANONICAL_DATASET_SLACK_WEBHOOK_URL` is present in the environment. Never print, log, persist, or expose the webhook URL. If it is missing or delivery fails, continue only if every alert payload is written to `slack_download_alerts.jsonl` with `delivery_status: pending` or `delivery_status: failed` and the exact non-secret failure reason.
- This canonical dataset is a raw public source package, not an analysis-ready table bundle.
- Do not publish processed tables, merged panels, shared entity models, cross-source joins, derived fields, or analysis-ready outputs as canonical dataset artifacts.
- Keep each source in source-specific raw paths with provider-native files/API responses, codebooks, README files, schemas, and documentation.
- Skip or defer credentialed, paid, anti-bot protected, private, unstable, or unclear-access sources; record the exact blocker instead of failing the whole build.
- Never write secrets, cookies, bearer tokens, private credentials, presigned URLs, or API keys into logs, inventories, docs, or artifacts.

## Source Catalog

Use this starting source catalog. Verify every URL and classify each source before downloading:

```text
{sourceCatalog}
```

## Required Dataset-Root Outputs

Write these exact files at the dataset root:

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
- `docs/public-datasets/briefings/{datasetId}.md`
- `docs/public-datasets/{datasetId}.mdx`

## Download Logging

Record one row/object in `download_inventory.jsonl` and `download_inventory.csv` at the mounted dataset root for every attempted source download, including failed, blocked, skipped, gated, and successful attempts.

Also append one event object to `download_events.jsonl` at the mounted dataset root for every download lifecycle event:

- `planned`
- `started`
- `succeeded`
- `failed`
- `blocked`
- `skipped`
- `gated`

Each event must include `dataset_id`, `run_id` when available, `source_id`, `source_name`, `request_url` with secrets redacted, `event_type`, `event_at`, `raw_path`, `http_status`, `bytes_written`, `content_hash_sha256`, and `message`.

For every download attempt, send one Slack webhook message through `CANONICAL_DATASET_SLACK_WEBHOOK_URL` after the terminal event (`succeeded`, `failed`, `blocked`, `skipped`, or `gated`). The alert must be self-contained: a user reading Slack must understand what the data actually is, not just the file name or path.

Each Slack message must include a concise plain-English data summary plus structured facts:

- start with a one-line headline in this shape: `[datasetId] source_name status: what this dataset contains; grain; geography; time span; row/object count or size; path; license/access caveat`;
- dataset id, source id/name, terminal status, and request URL with secrets redacted;
- raw path, bytes, content hash, and row/document/object count when known;
- what the observations/entities are, e.g. monthly national macroeconomic observations, address-level home sales, county-level rates, document images, metadata records, or API responses;
- geographic coverage at the most precise proven level, e.g. United States national aggregate, state, county, metro, address, global, or unknown/not inspected;
- time coverage and frequency/granularity when known;
- unit or measure names and meanings, including important column definitions;
- native format and schema/columns discovered from inspection;
- license/access status and any caveats;
- exact blocker for failed, blocked, skipped, or gated attempts;
- next action for failed, blocked, skipped, gated, license_review, or partial attempts, e.g. alternate endpoint to try, manual review needed, whitelisted access needed, or no action needed;
- what is not present when a source title or filename could mislead, e.g. explicitly say that a FRED national macro series is not address-level, county-level, metro-level, or transaction-level unless the inventory proves it.

Do not send thin alerts like `Download succeeded for raw/path.csv`. If a Slack message would not let a reader answer "what data is actually on disk, at what grain, where, for what dates, and with what caveats?", enrich it before sending or mark unknown fields as `unknown/not inspected`.

Log every Slack alert attempt to `slack_download_alerts.jsonl` with `delivery_status: sent|pending|failed`, `delivery_at`, non-secret HTTP status/error, and the complete structured message payload including `plain_english_data_summary`, `observations_or_entities`, `geographic_coverage`, `time_coverage`, `frequency_or_granularity`, `unit_or_measure`, `schema_or_columns`, `not_present_caveats`, and `blocker`. Write a final `slack_briefing.md` summarizing all download attempts, data summaries, blockers, and Slack delivery statuses.

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

Exclude remote agent runtime/tooling/cache directories from the canonical dataset volume when possible before final inventory, including `.remote-agent`, `.codex`, `.cache`, temporary plugin caches, and local virtual environments. If a runtime directory already exists on the mounted volume and cannot be removed, include it in `volume_inventory.*` but mark it with `source_family_guess: runtime_tooling` and call it out as non-dataset contamination in `dataset_briefing.md`, `quality_report.md`, and the final result.

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

- `docs/public-datasets/briefings/{datasetId}.md`
- `docs/public-datasets/{datasetId}.mdx`

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
- `downloadEventLogPath`
- `slackDownloadAlertsPath`
- `slackAlertsSent`
- `slackAlertsPending`

If any required inventory is missing or incomplete, set `diskInventoryProven: false` in the structured result and explain why.

## Final Response

Return a concise summary with:

- dataset id/name;
- exact dataset volume path used;
- all required artifact paths written;
- file count and total bytes from `volume_inventory_summary.json`;
- required artifacts missing, if any;
- run status and whether `diskInventoryProven` is true.
