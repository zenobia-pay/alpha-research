# Canonical Dataset Self-Improvement: {datasetName} (`{datasetId}`)

You are running a self-improvement pass for one canonical public Alpha Research dataset.

Execute the work now. Do not stop after writing a plan, checklist, or proposed steps. A response that only describes a plan without updating inventories, briefing files, CLI profile/readback, and artifacts is a failed run.

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
- Keep provider-native files/API responses, codebooks, schemas, documentation, and raw source artifacts in source-specific paths.
- Every attempted download must be logged in `download_inventory.*`.
- Every download lifecycle event must be appended to `download_events.jsonl`.
- Every terminal download attempt must send or queue one Slack webhook alert and append the delivery result to `slack_download_alerts.jsonl`.
- Every raw source artifact on disk must be logged in `raw_inventory.*`.
- Every file on the dataset volume must be logged in `volume_inventory.*`.
- `dataset_briefing.md` must be regenerated from the inventories, not from memory or narrative assumptions.
- `dataset_briefing.md` must be a literal English inventory of the data, not a provider/file list. The first useful section must be `# Data Inventory`, and every bullet must describe one concrete dataset/API response/document collection in plain English.

## Candidate Classification

Use Exa and public web/API searches to find newly relevant public sources for `{datasetName}`. Classify each candidate as exactly one of:

- `active_fetchable`
- `deferred_fetchable`
- `credential_required`
- `not_found`
- `reject`

Do not bypass paywalls, login walls, robots restrictions, anti-bot systems, institutional access controls, or private credential requirements.

Provider-level access failures are not run-level blockers. If one provider blocks or fails, write the exact attempted URL, HTTP status, response class, and source-specific blocker to `download_inventory.*`, `download_events.jsonl`, `candidate_sources.csv`, `quality_report.md`, Slack alerts, and `improvement_result.json`, then continue through the rest of the planned source catalog. Do not stop the whole run after BLS, FHFA, Treasury, or any other single provider blocks. A run may return `status: blocked` only if the mounted dataset volume cannot be read/written, Codex login is unavailable before any fetch, required inventories cannot be generated at all, or every planned source candidate has been classified/attempted and no further work remains possible.

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

## Keep The Briefing Up To Date

The briefing exists to answer one question: what data is actually there?

Write the dataset briefing as a comprehensive literal data inventory.

Write a comprehensive summary of every piece of data that is on this dataset. Make it comprehensive but concise and human readable. Phrase it as legible sentences.

Use this shape:

```md
# Data Inventory
- Consumer Price Index for All Urban Consumers, seasonally adjusted U.S. national monthly price index observations; one row per month; United States; 1947-01 through 2026-03. Data comes from FRED. The data fields are ... . The units are ...
```

## Slack Alert Rules

For every attempted download, send one concise Slack webhook message through `CANONICAL_DATASET_SLACK_WEBHOOK_URL` after the terminal event, and make the message explain what data was downloaded or what blocked the attempt in plain English. Log every Slack alert attempt to `slack_download_alerts.jsonl` with `delivery_status: sent|pending|failed`, never expose the webhook URL, and do not mark Slack as sent unless delivery was actually confirmed.

Before final volume inventory, avoid creating new remote agent runtime/tooling/cache directories on the dataset volume when possible. Do not delete active runtime directories during the run, including `.remote-agent`, `.codex`, `.cache`, temporary plugin caches, or local virtual environments; on this platform deleting active runtime directories can kill artifact capture and make the run fail. If runtime/tooling/cache directories are present on disk, inventory them as `runtime_tooling` contamination and make the briefing say clearly that they are not dataset data.

## Final Response

Return a concise summary with run status, new sources downloaded, deferred/rejected sources, files written, and whether `diskInventoryProven` is true.
