# Literature Canonical Improvement: Full Project Gutenberg Mirror

You are running an admin-owned canonical improvement job for the `literature` dataset. Execute the work now. Do not stop after writing a plan.

Goal: convert the `literature` dataset from "Project Gutenberg metadata plus a few text exemplars" into a disk-proven raw mirror of the full public Project Gutenberg corpus, including the official catalog metadata, RDF catalog records, mirror indexes/checksums/provenance, and all public mirror-permitted ebook assets available from official Project Gutenberg mirror endpoints.

## Scope

- Dataset id: `literature`.
- This is a canonical admin job, not a user-facing research analysis.
- Use the mounted dataset volume as the dataset root. Prefer `DATASET_MOUNT_PATH` when set; otherwise use `/mnt/alpha-research/datasets/literature`.
- Keep the dataset a raw public source package. Do not create merged panels, derived fields, normalized text tables, embeddings, feature tables, or analysis-ready outputs.
- Preserve existing non-Gutenberg literature sources already on disk unless they are clearly duplicated runtime/tooling contamination. Do not delete useful existing raw source data from Internet Archive, Open Library, Wikisource, Perseus, or license-review records.
- Never write secrets, cookies, bearer tokens, private credentials, presigned URLs, or API keys into logs, inventories, docs, or artifacts.

## Project Gutenberg Mirror Requirements

Use official Project Gutenberg mirror guidance and source endpoints. Classify each endpoint before download and record exact access status.

Required source candidates:

- Project Gutenberg mirror instructions and official rsync/FTP source: `https://www.gutenberg.org/help/mirroring.html`
- Project Gutenberg RDF catalog archives: `https://www.gutenberg.org/cache/epub/feeds/`
- Project Gutenberg catalog CSV/metadata feeds: `https://www.gutenberg.org/ebooks/offline_catalogs.html`
- Project Gutenberg generated book files under official `/files` and `/ebooks` paths, as exposed by the official mirror instructions
- Project Gutenberg license and terms: `https://www.gutenberg.org/policy/license.html`
- Project Gutenberg robots/crawler guidance: `https://www.gutenberg.org/robots.txt`
- Official mirror checksums, directory listings, and provenance files when available

Mirror the complete public corpus using the provider-recommended bulk mechanism, preferably official rsync/FTP mirror paths rather than one-off HTML scraping. Include all public mirror-permitted ebook assets physically available through that mirror mechanism, such as plain text, HTML, EPUB, Kindle/MOBI, RDF metadata, images, and auxiliary files when present and allowed. Keep provider-native directory structure under a source-specific raw path such as `raw/project_gutenberg_mirror/`.

If the runner cannot complete the full mirror because of disk capacity, network limits, endpoint restrictions, time limits, read-only volume, rsync/FTP unavailability, robots/crawler guidance, or any other blocker, do not pretend the mirror is complete. Preserve any safely downloaded partial data, mark it explicitly as partial, record exact blockers and remaining work, and set `diskInventoryProven: false` unless the mounted volume inventory proves the full mirror is present.

## Required Outputs

At the dataset root, update or create:

- `manifest.json`
- `source_registry.csv`
- `source_registry.plan.json`
- `candidate_sources.csv`
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
- `docs/public-datasets/briefings/literature.md`
- `docs/public-datasets/literature.mdx`
- `improvement_plan.md`
- `improvement_result.json`

## Logging And Provenance

Record every attempted source download in `download_inventory.jsonl` and `download_inventory.csv`, including successful, failed, blocked, skipped, gated, and partial attempts.

Append lifecycle events to `download_events.jsonl` for planned, started, succeeded, failed, blocked, skipped, gated, and partial events. Each event must include `dataset_id`, `run_id` when available, `source_id`, `source_name`, `request_url` with secrets redacted, `event_type`, `event_at`, `raw_path`, `http_status`, `bytes_written`, `content_hash_sha256`, and `message`.

Generate `raw_inventory.jsonl` and `raw_inventory.csv` from actual source files on disk. For the Project Gutenberg mirror, inventory the mirror root and representative subdirectories/files in enough detail that a reader can verify whether full-text ebook assets are physically present, not merely catalog metadata.

Generate `volume_inventory.jsonl`, `volume_inventory.csv`, `volume_inventory_summary.json`, and `volume_tree.txt` by recursively inspecting the mounted dataset volume after all writes. `volume_inventory.jsonl` is the source of truth for disk proof.

Slack alerts must be rich and self-contained. If the webhook is absent or delivery fails, write pending/failed payloads to `slack_download_alerts.jsonl` and summarize them in `slack_briefing.md` without exposing the webhook URL.

## Briefing Requirements

Generate `dataset_briefing.md` only from the download, raw, and volume inventories. The first useful section must be `# Literal Data Inventory`.

The briefing must plainly answer:

- whether the full Project Gutenberg mirror is physically present on disk;
- whether Project Gutenberg full texts/assets are complete, partial, or absent;
- exact counts proven from disk where feasible, including file count, total bytes, ebook id coverage, and major format families;
- what Project Gutenberg metadata/catalog/RDF files are present;
- what non-Gutenberg literature sources remain present;
- what blockers or caveats prevent a full mirror claim.

Do not say "all Project Gutenberg" or "full mirror" unless the final volume inventory proves it. If only metadata, sample texts, or a partial mirror exists, state that directly in the briefing and profile.

Mirror the final briefing into:

- `docs/public-datasets/briefings/literature.md`
- `docs/public-datasets/literature.mdx`

## CLI Profile And Readback

Update the CLI-visible dataset profile for `literature` with the final `dataset_briefing.md`. Use the authenticated backend session available to the runner or the `update_remote_dataset_profile` tool if available. Do not rely only on shell `curl`, localhost URLs, guessed service hostnames, or a nonexistent CLI subcommand.

Read back `GET /api/cli/datasets/literature` or the equivalent available tool/CLI path and verify that the returned profile/briefing contains `# Literal Data Inventory`, the current run/execution id, and a direct statement about Project Gutenberg mirror completeness.

If profile update or readback fails, set `diskInventoryProven: false` in `improvement_result.json` and record the exact non-secret blocker.

## Final Artifacts

Copy these files into the remote run artifact directory before final response:

- `dataset_briefing.md`
- `docs/public-datasets/briefings/literature.md`
- `docs/public-datasets/literature.mdx`
- `manifest.json`
- `source_registry.csv`
- `candidate_sources.csv`
- `download_inventory.jsonl`
- `raw_inventory.jsonl`
- `volume_inventory_summary.json`
- `quality_report.md`
- `slack_briefing.md`
- `improvement_plan.md`
- `improvement_result.json`

`improvement_result.json` must include:

- `datasetId`
- `status`
- `startedAt`
- `completedAt`
- `runId` or admin execution id when available
- `projectGutenbergMirrorStatus`: `complete`, `partial`, `metadata_only`, `blocked`, or `failed`
- `projectGutenbergMirrorRoot`
- `projectGutenbergFileCount`
- `projectGutenbergTotalBytes`
- `projectGutenbergEbookIdCount`
- `diskInventoryProven`
- `profileUpdated`
- `profileReadbackVerified`
- `slackAlertsSent`
- `slackAlertsPending`
- `blockers`
- `nextActions`

Provider-level access failures are not run-level blockers. Continue through all Project Gutenberg mirror/catalog/license/checksum candidates and existing literature source inventories even if one endpoint blocks. A run may return `status: blocked` only if the mounted dataset volume cannot be read/write inspected, Codex login is unavailable before any fetch, required inventories cannot be generated, or all mirror mechanisms are unavailable and no further work remains possible.
