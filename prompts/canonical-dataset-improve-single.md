# Canonical Dataset Self-Improvement: {datasetName} (`{datasetId}`)

Run a self-improvement pass for this canonical public Alpha Research dataset now.

Field brief:

```text
{fieldBrief}
```

## Instructions

1. Use the mounted dataset volume as the dataset root. Prefer `DATASET_MOUNT_PATH`; otherwise use `/mnt/alpha-research/datasets/{datasetId}`.
2. Read the existing dataset state: inventories, source registry, manifest, data dictionary, quality report, briefing, download events, and Slack alert log.
3. Regenerate stale or missing disk inventories before making changes.
4. Verify the remote runner has an authenticated Codex CLI/session and that `CANONICAL_DATASET_SLACK_WEBHOOK_URL` is available.
5. Search for relevant public sources for `{datasetName}` with Exa and public web/API search.
6. Classify each candidate as `active_fetchable`, `deferred_fetchable`, `credential_required`, `not_found`, or `reject`.
7. Fetch active public machine-readable sources into source-specific paths on the mounted dataset volume.
8. Record every attempted download in `download_inventory.jsonl`, `download_inventory.csv`, and `download_events.jsonl`.
9. Send or queue one concise Slack alert for every terminal download attempt, and log the delivery result in `slack_download_alerts.jsonl`.
10. Update `raw_inventory.jsonl`, `raw_inventory.csv`, `volume_inventory.jsonl`, `volume_inventory.csv`, `volume_inventory_summary.json`, and `volume_tree.txt` from the current disk state.
11. Update `manifest.json`, `source_registry.csv`, `source_registry.plan.json`, `data_dictionary.md`, `quality_report.md`, `slack_briefing.md`, `improvement_plan.md`, and `improvement_result.json`.
12. Regenerate `dataset_briefing.md` from the current inventories.

## Archive And Package Inspection

Canonical datasets often store provider ZIP, tar, gzip, bulk, or SDMX packages. A package name is not an inventory.

For every stored archive or packaged provider payload that contains source data:

- inspect the package members directly with `zipinfo`, `unzip -l`, `tar -tf`, provider manifests, codebooks, or equivalent tools before writing the briefing;
- record member-level facts in the inventories whenever possible: member path/name, compressed/uncompressed size, detected format, row count when measurable, schema/columns when measurable, geography fields, time fields, and unit/measure fields;
- when members are too large to fully parse, sample headers/first rows and record the exact inspection limit;
- if a package cannot be opened, keep the package in the inventory but mark the briefing fact as `unknown/not inspected` instead of making a broad claim;
- do not write briefing bullets like `ZIP contents`, `bulk archive`, `provider ZIP packaging`, `microdata archive`, or `SDMX payload` unless the same bullet also states the exact tables/files/responses inside and what each one contains.

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

Do not write a provider/package list.

Write a comprehensive summary of every piece of data that is on this dataset. Make it comprehensive but concise and human readable. Phrase it as legible sentences.

Every bullet must be specific enough that a reader can answer: what exact table/API response/document collection is stored, what the records represent, what grain/frequency it has, what geography it covers, what dates/vintages it covers, how many rows/objects are present when measurable, and what the important columns/fields/units mean.

If a source is stored as an archive, the bullet must name the data-bearing archive members or tables and summarize each member's contents. Do not collapse archives into opaque phrases such as `ZIP contents`, `ZIP archive`, `bulk archive`, `provider packaging`, `microdata files`, or `source package`.

Bad:

```md
- Bureau of Economic Analysis CAINC1 ZIP archive: annual state personal income tables covering 1969-2024 stored in provider ZIP packaging alongside layout documentation.
```

Good:

```md
- Bureau of Economic Analysis CAINC1 state annual personal income package: the stored archive contains table CAINC1 data files for annual state personal income and per-capita personal income observations by state and line code for 1969-2024, plus provider layout/codebook files defining fields such as GeoFIPS, GeoName, LineCode, Description, Unit, TimePeriod, and DataValue. The data rows are annual state-level BEA regional income measures; units vary by line and are defined in the included layout/codebook.
```

Use this shape:

```md
# Data Inventory
- Consumer Price Index for All Urban Consumers, seasonally adjusted U.S. national monthly price index observations; one row per month; United States; 1947-01 through 2026-03. Data comes from FRED. The data fields are ... . The units are ...
```

## Slack Alerts

Send one concise Slack webhook message for every terminal download attempt, explaining in plain English what data was downloaded or what blocked the attempt. Log every Slack alert attempt to `slack_download_alerts.jsonl` with `delivery_status: sent|pending|failed`, never expose the webhook URL, and mark `sent` only after confirmed delivery.

## Final Response

Return a concise summary with run status, new sources downloaded, deferred/rejected sources, files written, and whether `diskInventoryProven` is true.
