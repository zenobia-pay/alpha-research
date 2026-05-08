# Canonical Dataset Self-Improvement: Econ (`econ`)

You are running a self-improvement pass for one canonical public Alpha Research dataset.

Field brief:

```text
Focused Econ briefing/profile repair test. Do not perform broad source expansion. Read the current mounted inventories and current dataset_briefing.md, preserve the existing raw holdings, regenerate only if stale, then ensure dataset_briefing.md, docs mirrors, and CLI briefingMarkdown are a comprehensive # Literal Data Inventory. Use the update_remote_dataset_profile tool/function if available; do not rely on shell curl or localhost for the profile update. Copy dataset_briefing.md, docs/public-datasets/briefings/econ.md, docs/public-datasets/econ.mdx, improvement_result.json, and volume_inventory_summary.json into the remote run artifact directory. Verify GET/readback contains # Literal Data Inventory and this run id.
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
- Use the mounted dataset volume as the dataset root. Prefer `DATASET_MOUNT_PATH` when set; otherwise use `/mnt/alpha-research/datasets/econ`. Do not write canonical artifacts under a local throwaway `dataset/` directory unless it is a symlink or bind mount to the mounted dataset volume.
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
- `dataset_briefing.md` must be a literal English inventory of the data, not a provider/file list. The first useful section must be `# Literal Data Inventory`, and every bullet must describe one concrete dataset/file/API response/document collection in plain English before mentioning its path.

## Candidate Classification

Use Exa and public web/API searches to find newly relevant public sources for `Econ`. Classify each candidate as exactly one of:

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
- `docs/public-datasets/briefings/econ.md`
- `docs/public-datasets/econ.mdx`

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
- `docs/public-datasets/briefings/econ.md`
- `docs/public-datasets/econ.mdx`
- the CLI-visible dataset profile returned by `GET /api/cli/datasets/econ`

The CLI-visible profile update is mandatory. Use the authenticated backend session available to the runner to update the dataset profile endpoint, for example `POST /api/cli/datasets/econ/profile`, with `briefingMarkdown` set to the exact `dataset_briefing.md` body. Then read back `GET /api/cli/datasets/econ` and verify that the returned profile/briefing markdown exactly contains the new `# Literal Data Inventory` section and the current run id. If this readback fails, mark `status: "blocked"`, set `diskInventoryProven: false`, and write the exact non-secret blocker to `improvement_result.json`.

If the Codex tool/function `update_remote_dataset_profile` is available, use that tool for the profile update. Do not try to satisfy this requirement only with shell `curl`, localhost URLs, guessed service hostnames, or a nonexistent `codex datasets profile` subcommand. Shell HTTP attempts may be used only as diagnostics after the tool is unavailable or fails.

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

## Literal Briefing Rules

The briefing exists to answer one question: what data is actually there?

Write `dataset_briefing.md`, `docs/public-datasets/briefings/econ.md`, `docs/public-datasets/econ.mdx`, and `briefingMarkdown` as a comprehensive literal data inventory. Do not start with filenames, provider acronyms, or vague category names such as `BIS`, `FRED`, `housing`, or `microdata`.

Use this shape:

```md
# Literal Data Inventory
- Consumer Price Index for All Urban Consumers, seasonally adjusted U.S. national monthly price index observations; one row per month; United States; 1947-01 through 2026-03; columns ...; unit ...; source FRED CPIAUCSL; stored at `raw/fred/CPIAUCSL.csv`; license/access ...; caveats/not present ...
```

For every raw inventory record that represents actual source data, include one bullet with:

- what the data literally measures or contains;
- the observed entities/records, e.g. persons, households, housing units, city-month home value index rows, bank-country-quarter positions, macro time-series observations, HTML chronology records, API response objects;
- grain/frequency, e.g. person-level, household-level, housing-unit-level, city-month, state-quarter, metro-quarter, country-quarter, national-month, national-day;
- geography covered and the exact level of geography;
- time coverage or collection vintage;
- row/document/object count and bytes when measurable;
- important columns/fields and units/measures;
- source name/id and request URL with secrets redacted;
- raw path after the English description;
- license/access status and redistribution caveats;
- explicit not-present caveats when a reader might otherwise assume address-level records, transaction-level records, county coverage, metros, microdata, or analysis-ready joins.

Group bullets only after each bullet remains self-contained. If there are multiple files for one source, do not collapse them into one vague provider line unless the inventory proves they are one logical package and the bullet still names all concrete data contents, grains, geographies, coverage, paths, and counts.

Add a `# Blocked Or Missing Data` section with one bullet per failed/blocked/deferred terminal attempt. Each bullet must describe the intended data that is not on disk, the exact URL/status/error, why it matters, and the next route to try.

Add a `# Non-Data Artifacts On Disk` section for inventories, manifests, docs mirrors, quality reports, Slack logs, runtime/tooling contamination, and any unreadable files. These must not be mixed into the source-data inventory.

Before final response, copy these files into the remote run artifact directory as produced artifacts so the orchestrator can recover the exact briefing even if profile sync fails:

- `dataset_briefing.md`
- `docs/public-datasets/briefings/econ.md`
- `docs/public-datasets/econ.mdx`
- `improvement_result.json`
- `volume_inventory_summary.json`

If the artifact directory path is not obvious, use the active remote-agent workspace artifacts directory under `.remote-agent/workspaces/<run-id>/artifacts/`. Do not omit these artifacts just because the same files also exist at the dataset root.

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

Before final volume inventory, avoid creating new remote agent runtime/tooling/cache directories on the dataset volume when possible. Do not delete active runtime directories during the run, including `.remote-agent`, `.codex`, `.cache`, temporary plugin caches, or local virtual environments; on this platform deleting active runtime directories can kill artifact capture and make the run fail. If runtime/tooling/cache directories are present on disk, inventory them as `runtime_tooling` contamination and make the briefing say clearly that they are not dataset data.

## Final Response

Return a concise summary with run status, new sources downloaded, deferred/rejected sources, files written, docs updated, and whether `diskInventoryProven` is true.
