# Canonical Dataset Improvement Run

You are running a daily self-improvement pass for the canonical public Alpha Research dataset `{datasetId}` (`{datasetName}`).

## Goal

Reason over the current dataset, search the internet with Exa, and decide whether there are newly relevant public datasets, archives, APIs, corpora, or metadata releases that should be added to this field's canonical dataset.

This is an improvement-planning run. Do not mutate the canonical dataset directly unless a source is clearly public, stable, machine-fetchable, license-compatible, and low-risk. Prefer producing a precise expansion plan over speculative ingestion.

## Required Environment

- Dataset mount: use `DATASET_MOUNT_PATH` and the workspace `dataset` symlink.
- Manifest: use `MANIFEST_PATH` when it exists.
- Exa: use `EXA_API_KEY` from the environment. Never print or write the key.
- Slack alerts: use `CANONICAL_DATASET_SLACK_WEBHOOK_URL` from the environment. Never print or write the webhook URL.

If `EXA_API_KEY` is missing, write `artifacts/improvement_result.json` with `status: "blocked"` and `blocker: "missing_exa_api_key"`, write `artifacts/improvement_plan.md`, and stop.

If `CANONICAL_DATASET_SLACK_WEBHOOK_URL` is missing, continue the research and write a `slack_alerts_pending` array in `improvement_result.json`; do not fail the whole run just because Slack is missing.

## Field Scope

Use this field brief as the scope boundary:

```text
{fieldBrief}
```

## Procedure

1. Inspect the current dataset files, manifest, source registry, previous expansion plans, data dictionary, quality report, and dataset briefing if present.
2. Summarize current coverage by source family, geography, time coverage, document/table types, known gaps, and deferred/blocked sources.
3. Use Exa search to find newly relevant public sources for `{datasetName}`. Query for:
   - public dataset releases in the last 30 days and last year;
   - major archives, APIs, codebooks, benchmark corpora, catalogs, or metadata dumps;
   - university, government, nonprofit, museum/library/archive, and standards-body datasets;
   - field-specific repositories that the current dataset does not already cover.
4. For every candidate, classify it as exactly one of:
   - `active_fetchable`: public, stable, machine-fetchable, license-compatible, and worth adding soon.
   - `deferred_fetchable`: probably useful and fetchable, but lower priority or needs schema planning.
   - `license_review`: promising but license/terms are unclear.
   - `credential_required`: relevant but requires login, API approval, payment, institutional access, or private credentials.
   - `not_found`: the source appears relevant by name/citation but no stable public download/API/catalog endpoint was found.
   - `reject`: irrelevant, brittle, spammy, duplicated, too narrow, or unsafe to fetch.
5. For each `not_found`, `credential_required`, or high-value `license_review` candidate, send one concise Slack webhook alert. Include dataset id, candidate name, why it matters, what is missing, URLs checked, and the recommended human action. If Slack delivery fails, record it in `slack_alerts_pending`.
6. Decide what should happen next:
   - promote to active fetch target;
   - defer;
   - request human review;
   - reject.

## Required Outputs

Write these files in the artifact directory:

- `improvement_plan.md`
- `improvement_result.json`
- `candidate_sources.csv`
- `exa_search_log.json`

`improvement_result.json` must include:

```json
{
  "datasetId": "{datasetId}",
  "datasetName": "{datasetName}",
  "status": "completed|blocked",
  "checkedAt": "ISO-8601 timestamp",
  "currentCoverageSummary": {},
  "promoteNow": [],
  "defer": [],
  "needsHumanReview": [],
  "rejected": [],
  "slackAlertsSent": [],
  "slackAlertsPending": [],
  "nextRunHints": []
}
```

## Safety Rules

- Do not use private user data.
- Do not bypass paywalls, login walls, robots restrictions, anti-bot systems, or institutional access controls.
- Do not write secrets, webhook URLs, API keys, presigned URLs, cookies, or bearer tokens into artifacts or logs.
- Do not mark a source `active_fetchable` unless there is a stable public endpoint and a plausible license/access path.
- Prefer fewer, higher-quality additions over broad noisy source lists.
