# Canonical Dataset Self-Improvement: {datasetName} (`{datasetId}`)

You are running a self-improvement pass for one canonical public Alpha Research dataset.

Field brief:

```text
{fieldBrief}
```

## First, Ground In Disk Truth

Before searching or changing anything, read these files from the mounted dataset volume when present:

- `volume_inventory.jsonl`
- `volume_inventory.csv`
- `volume_inventory_summary.json`
- `volume_tree.txt`
- `download_inventory.jsonl`
- `download_inventory.csv`
- `raw_inventory.jsonl`
- `raw_inventory.csv`
- `dataset_briefing.md`
- `quality_report.md`
- `source_registry.csv`
- `source_registry.plan.json`
- `download_events.jsonl`
- `slack_download_alerts.jsonl`
- `slack_briefing.md`

If `volume_inventory.*` is missing or stale, regenerate it before doing external research.

## Dataset Contract

- Public data only. Do not use private user data.
- Use the mounted dataset volume as the dataset root. Prefer `DATASET_MOUNT_PATH` when set; otherwise use `/mnt/alpha-research/datasets/{datasetId}`. Do not write canonical artifacts under a local throwaway `dataset/` directory unless it is a symlink or bind mount to the mounted dataset volume.
- Before any fetch, verify the remote runner has an authenticated Codex CLI/session available. If Codex is not logged in, stop before downloads, write the exact blocker to `improvement_result.json`, and set `diskInventoryProven: false`.
- Before any fetch, check `CANONICAL_DATASET_SLACK_WEBHOOK_URL` is present in the environment. Never print, log, persist, or expose the webhook URL. If it is missing or delivery fails, continue only if every alert payload is written to `slack_download_alerts.jsonl` with `delivery_status: pending` or `delivery_status: failed` and the exact non-secret failure reason.
- This canonical dataset is a raw public source package.
- Do not publish processed tables, merged panels, shared entity models, cross-source joins, derived fields, or analysis-ready outputs as canonical dataset artifacts.
- Keep provider-native files/API responses, codebooks, schemas, documentation, and raw source artifacts in source-specific paths.
- Every attempted download must be logged in `download_inventory.*`.
- Every download lifecycle event must be appended to `download_events.jsonl`.
- Every terminal download attempt must send or queue one Slack webhook alert and append the delivery result to `slack_download_alerts.jsonl`.
- Every raw source artifact on disk must be logged in `raw_inventory.*`.
- Every file on the dataset volume must be logged in `volume_inventory.*`.
- `dataset_briefing.md` must be regenerated from the inventories, not from memory or narrative assumptions.

## Candidate Classification

Use Exa and public web/API searches to find newly relevant public sources for `{datasetName}`. Classify each candidate as exactly one of:

- `active_fetchable`
- `deferred_fetchable`
- `license_review`
- `credential_required`
- `not_found`
- `reject`

If a source is public and machine-fetchable but license-unclear, download it only with `license_status: needs_review` and explicit caveats in all inventories, result files, and the briefing.

Do not bypass paywalls, login walls, robots restrictions, anti-bot systems, institutional access controls, or private credential requirements.

Provider-level access failures are not run-level blockers. If one provider blocks or fails, write the exact attempted URL, HTTP status, response class, and source-specific blocker to `download_inventory.*`, `download_events.jsonl`, `candidate_sources.csv`, `quality_report.md`, `dataset_briefing.md`, docs mirrors, Slack alerts, and `improvement_result.json`, then continue through the rest of the planned source catalog. Do not stop the whole run after BLS, FHFA, Treasury, or any other single provider blocks. A run may return `status: blocked` only if the mounted dataset volume cannot be read/written, Codex login is unavailable before any fetch, required inventories cannot be generated at all, or every planned source candidate has been classified/attempted and no further work remains possible.

## Required Outputs

Write or update these files at the dataset root:

- `improvement_plan.md`
- `improvement_result.json`
- `candidate_sources.csv`
- `exa_search_log.json`
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
- `manifest.json`
- `source_registry.csv`
- `source_registry.plan.json`
- `data_dictionary.md`
- `quality_report.md`
- `dataset_briefing.md`
- `docs/public-datasets/briefings/{datasetId}.md`
- `docs/public-datasets/{datasetId}.mdx`

`improvement_result.json` must include:

```json
{
  "datasetId": "{datasetId}",
  "datasetName": "{datasetName}",
  "status": "completed|blocked",
  "checkedAt": "ISO-8601 timestamp",
  "diskInventoryProven": true,
  "volumeInventoryUpdatedAt": "ISO-8601 timestamp",
  "currentCoverageSummary": {},
  "downloadedSources": [],
  "downloadedLicenseReviewSources": [],
  "downloadAttempts": [],
  "downloadEventLogPath": "download_events.jsonl",
  "slackDownloadAlertsPath": "slack_download_alerts.jsonl",
  "slackBriefingPath": "slack_briefing.md",
  "slackAlertsSent": [],
  "slackAlertsPending": [],
  "promoteNow": [],
  "defer": [],
  "needsHumanReview": [],
  "rejected": [],
  "notFound": [],
  "nextRunHints": []
}
```

## Docs And CLI Profile Update

After downloads, inventories, and briefing regeneration, update all three public/CLI surfaces from the same inventory-derived briefing:

- dataset-root `dataset_briefing.md`
- `docs/public-datasets/briefings/{datasetId}.md`
- `docs/public-datasets/{datasetId}.mdx`
- the CLI-visible dataset profile returned by `GET /api/cli/datasets/{datasetId}`

The CLI-visible profile update must include:

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

If any required inventory is missing, stale, or not generated from the current mounted volume, set `diskInventoryProven: false`, explain the exact blocker in `improvement_result.json`, and do not claim docs or CLI proof are current. If Slack alerts are pending or failed, the profile briefing and quality fields must say that directly. Do not mark Slack as sent unless delivery was actually confirmed.

## Slack Alert Rules

For every attempted download, send one concise Slack webhook message through `CANONICAL_DATASET_SLACK_WEBHOOK_URL` after the terminal event (`succeeded`, `failed`, `blocked`, `skipped`, or `gated`). The alert must be self-contained: a user reading Slack must understand what the data actually is, not just the file name or path.

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

Log every Slack alert attempt to `slack_download_alerts.jsonl` with `delivery_status: sent|pending|failed`, `delivery_at`, non-secret HTTP status/error, and the complete structured message payload including `plain_english_data_summary`, `observations_or_entities`, `geographic_coverage`, `time_coverage`, `frequency_or_granularity`, `unit_or_measure`, `schema_or_columns`, `not_present_caveats`, and `blocker`.

Do not fail the whole run just because Slack is unavailable. Instead, write the pending/failed message payload and non-secret delivery error to `slack_download_alerts.jsonl`, add it to `slackAlertsPending`, and call it out in `slack_briefing.md` and the final response.

Before final volume inventory, remove or avoid writing remote agent runtime/tooling/cache directories to the dataset volume when possible, including `.remote-agent`, `.codex`, `.cache`, temporary plugin caches, and local virtual environments. If they remain on disk, inventory them as `runtime_tooling` contamination and make the briefing say clearly that they are not dataset data.

## Final Response

Return a concise summary with run status, new sources downloaded, deferred/rejected sources, files written, docs updated, and whether `diskInventoryProven` is true.
