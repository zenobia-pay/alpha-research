# Canonical Dataset Self-Improvement: Econ (`econ`)

Run a self-improvement pass for this canonical public Alpha Research dataset now.

Field brief:

```text
Improve and refresh the public dataset inventory briefing for economics (sources, licensing, blockers, and next steps).
```

## Instructions

1. Use the mounted dataset volume as the dataset root. Prefer `DATASET_MOUNT_PATH`; otherwise use `/mnt/alpha-research/datasets/econ`.
2. Read the existing dataset state: inventories, source registry, manifest, data dictionary, quality report, briefing, download events, and Slack alert log.
3. Regenerate stale or missing disk inventories before making changes.
4. Verify the remote runner has an authenticated Codex CLI/session and that `CANONICAL_DATASET_SLACK_WEBHOOK_URL` is available.
5. Search for relevant public sources for `Econ` with Exa and public web/API search.
6. Classify each candidate as `active_fetchable`, `deferred_fetchable`, `credential_required`, `not_found`, or `reject`.
7. Fetch active public machine-readable sources into source-specific paths on the mounted dataset volume.
8. Record every attempted download in `download_inventory.jsonl`, `download_inventory.csv`, and `download_events.jsonl`.
9. Send or queue one concise Slack alert for every terminal download attempt, and log the delivery result in `slack_download_alerts.jsonl`.
10. Update `raw_inventory.jsonl`, `raw_inventory.csv`, `volume_inventory.jsonl`, `volume_inventory.csv`, `volume_inventory_summary.json`, and `volume_tree.txt` from the current disk state.
11. Update `manifest.json`, `source_registry.csv`, `source_registry.plan.json`, `data_dictionary.md`, `quality_report.md`, `slack_briefing.md`, `improvement_plan.md`, and `improvement_result.json`.
12. Regenerate `dataset_briefing.md` from the current inventories.

`improvement_result.json` must include:

```json
{
  "datasetId": "econ",
  "datasetName": "Econ",
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

## Slack Alerts

Send one concise Slack webhook message for every terminal download attempt, explaining in plain English what data was downloaded or what blocked the attempt. Log every Slack alert attempt to `slack_download_alerts.jsonl` with `delivery_status: sent|pending|failed`, never expose the webhook URL, and mark `sent` only after confirmed delivery.

## Final Response

Return a concise summary with run status, new sources downloaded, deferred/rejected sources, files written, and whether `diskInventoryProven` is true.
