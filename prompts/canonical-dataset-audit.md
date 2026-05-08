# Canonical Dataset Disk Audit: {datasetName} (`{datasetId}`)

Execute the work now. Do not stop after writing a plan, checklist, or proposed steps. A response that only describes a plan without regenerating inventories, briefing files, CLI profile/readback, and artifacts is a failed run.

Audit the mounted canonical dataset volume for `{datasetId}`. Do not fetch external sources and do not use private data.

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
- `docs/public-datasets/briefings/{datasetId}.md`
- `docs/public-datasets/{datasetId}.mdx`

## Download And Slack Audit Rules

Use `download_inventory.jsonl` / `.csv` as the source of truth for terminal download attempts already recorded on disk.

For every terminal attempt in `download_inventory.*`:

- ensure `download_events.jsonl` has at least a terminal event row (`succeeded`, `failed`, `blocked`, `skipped`, or `gated`) with dataset id, source id/name, redacted request URL, raw path, HTTP status, bytes, hash, and message;
- ensure `slack_download_alerts.jsonl` has one corresponding alert delivery row.

Every Slack alert row and every backfill message must be self-contained: a user reading Slack must understand what the data actually is, not just the file name or path. Enrich each alert from `download_inventory.*`, `raw_inventory.*`, `volume_inventory.*`, `data_dictionary.md`, `source_registry.*`, `dataset_briefing.md`, and direct file inspection when the raw file exists. If a fact cannot be proven, write `unknown/not inspected` instead of guessing.

Each Slack alert payload must include a concise plain-English data summary plus structured facts:

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

Do not send or backfill thin alerts like `Download succeeded for raw/path.csv`. If a Slack message would not let a reader answer "what data is actually on disk, at what grain, where, for what dates, and with what caveats?", enrich it before sending or mark unknown fields as `unknown/not inspected`.

If an existing `slack_download_alerts.jsonl` row lacks the rich fields `plain_english_data_summary`, `observations_or_entities`, `geographic_coverage`, `time_coverage`, `frequency_or_granularity`, `unit_or_measure`, `schema_or_columns`, `not_present_caveats`, and `blocker`, rewrite or supersede it with an enriched row. If the webhook is available, send a backfill Slack alert for missing or thin alerts and write `delivery_status: sent`. If the webhook is missing or delivery fails, write `delivery_status: pending` or `delivery_status: failed` with the non-secret reason. Never print or persist the webhook URL.

Write `slack_briefing.md` summarizing sent, pending, and failed Slack alerts, including the data summary, geography, time coverage, units/measures, schema, row count, blockers, and not-present caveats for each terminal attempt.

## Volume Inventory Rules

Recursively inspect the mounted dataset volume after all writes. `volume_inventory.jsonl` is the source of truth for what is on disk and must include one row/object for every file.

Before final inventory, avoid creating new remote agent runtime/tooling/cache directories on the dataset volume when possible, including `.remote-agent`, `.codex`, `.cache`, temporary plugin caches, and local virtual environments. Do not delete active runtime directories during the run; on this platform deleting active runtime directories can kill artifact capture and make the run fail. If they remain on disk, include them in the inventory with `source_family_guess: runtime_tooling` and report them as non-dataset contamination in `dataset_briefing.md` and `quality_report.md`.

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

The briefing must be a literal English inventory of the data, not a provider/file list. The first useful section must be `# Literal Data Inventory`, and every bullet must describe one concrete dataset/API response/document collection in plain English.

The briefing must clearly state:

- what data is physically stored;
- exact source/data families that are physically represented;
- tabular schemas and row counts when measurable;
- whether this is raw data, source registry only, normalized tables, or mixed.

For every raw inventory record that represents actual source data, include one bullet with what the data literally measures or contains; observed entities/records; grain/frequency; geography and geography level; time coverage or collection vintage; row/document/object count when measurable; and important columns/fields and units/measures. Do not collapse concrete datasets into vague provider names.

Do not include file names or blocked / missing data, or metadata in the briefing. Just include exactly what data is stored. Do not include paths, URLs, licenses, byte sizes, run ids, dashboard links, required artifact status, Slack status, inventory status, runtime/tooling files, docs mirrors, manifests, quality reports, failed inspection rows, or non-data artifacts in `dataset_briefing.md`, docs mirrors, or `briefingMarkdown`. Keep those facts in inventories, quality reports, result JSON, Slack logs, and final run summaries instead.

Mirror the final briefing into:

- `docs/public-datasets/briefings/{datasetId}.md`
- `docs/public-datasets/{datasetId}.mdx`

Update the CLI-visible dataset profile after the audit using the same inventory-derived facts. The profile update must include:

- `briefingMarkdown`
- `sources`
- `tables`
- `quality.diskInventoryProven: true`
- `quality.volumeInventoryRunId`
- `quality.volumeInventoryUpdatedAt`
- `quality.downloadEventLogPath`
- `quality.slackDownloadAlertsPath`
- `quality.slackBriefingPath`
- `quality.slackAlertsSent`
- `quality.slackAlertsPending`
- `limitations`

The CLI-visible profile update is mandatory. Use the authenticated backend session available to the runner to update the dataset profile endpoint, for example `POST /api/cli/datasets/{datasetId}/profile`, with `briefingMarkdown` set to the exact `dataset_briefing.md` body. Then read back `GET /api/cli/datasets/{datasetId}` and verify that the returned profile/briefing markdown exactly contains the new `# Literal Data Inventory` section and the current run id. If this readback fails, mark `diskInventoryProven: false` and write the exact non-secret blocker.

If the Codex tool/function `update_remote_dataset_profile` is available, use that tool for the profile update. Do not try to satisfy this requirement only with shell `curl`, localhost URLs, guessed service hostnames, or a nonexistent `codex datasets profile` subcommand. Shell HTTP attempts may be used only as diagnostics after the tool is unavailable or fails.

Before final response, copy `dataset_briefing.md`, `docs/public-datasets/briefings/{datasetId}.md`, `docs/public-datasets/{datasetId}.mdx`, `volume_inventory_summary.json`, and the structured result into the remote run artifact directory as produced artifacts so the orchestrator can recover the exact briefing even if profile sync fails. If the artifact directory path is not obvious, use the active remote-agent workspace artifacts directory under `.remote-agent/workspaces/<run-id>/artifacts/`.

If Slack alerts are pending or failed, the quality fields and audit result must say that directly. Do not mark Slack as sent unless delivery was actually confirmed.

## Final Response

Return file count, total bytes, required artifacts missing, unreadable file count, and whether `diskInventoryProven` is true.
