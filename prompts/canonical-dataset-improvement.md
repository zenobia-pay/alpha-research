# Canonical Dataset Improvement Run

You are running a daily self-improvement pass for the canonical public Alpha Research dataset `{datasetId}` (`{datasetName}`).

## Goal

Reason over the current dataset briefing, search the internet with Exa, and decide whether there are newly relevant public datasets, archives, APIs, corpora, or metadata releases that should be added to this field's canonical dataset.

This is an improvement-and-briefing run. The dataset owns its own `dataset_briefing.md`; that briefing is the CLI's first source of truth for what the dataset contains. Canonical datasets are raw public source packages. Do not publish processed tables, merged panels, shared entity models, cross-source joins, derived fields, or analysis-ready tables as canonical dataset artifacts.

If a source is clearly public, stable, machine-fetchable, license-compatible, low-risk, and relevant, download the raw provider files/API responses into source-specific paths, record provenance, describe exact native shape, and rewrite the briefing. If a source is promising but not safely fetchable, do not ingest it; record the reason in the plan and alert Slack when human action is needed.

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

1. Inspect the current dataset files, manifest, source registry, previous expansion plans, data dictionary, quality report, and `dataset_briefing.md`. If no briefing exists, create one before doing external research.
2. Summarize current raw coverage by source family, geography, time coverage, document/object/file types, known gaps, and deferred/blocked sources. Be exact: list every raw source artifact that exists, its path, format, byte count, hash, row/document/object count when measurable, native fields/schema, native keys, temporal coverage, geographic/topic coverage, source ids, quality notes, and known limitations.
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
5. For each `active_fetchable` source, download the source into a source-specific raw path, compute hashes, and inspect its exact native shape. Do not create processed outputs as canonical artifacts.
6. Update `download_inventory.jsonl`/`.csv`, `raw_inventory.jsonl`/`.csv`, `manifest.json`, `source_registry.csv`, `source_registry.plan.json`, `data_dictionary.md`, and `quality_report.md` for every new or refreshed source.
7. Remove older processed/derived artifacts from the canonical published artifact set, or mark them deprecated in the briefing if they still exist in the mounted version and cannot be removed during this run.
8. Rewrite `dataset_briefing.md` so it is comprehensive and exact about the whole dataset after the run. Include:
   - source inventory and fetch/provenance details;
   - exact raw artifact inventory;
   - native schemas/fields with plain-English meanings;
   - native keys, time coverage, geography/topic coverage, row/document/object counts, formats, byte counts, and hashes where available;
   - explicit list of deprecated processed artifacts removed or still pending removal;
   - quality checks, missingness, caveats, limitations, deferred/gated sources, and next refresh hints.
9. Mirror the final briefing into the docs copy for this dataset, preserving frontmatter if present:
   - `docs/public-datasets/briefings/{datasetId}.md`
   - `docs/public-datasets/{datasetId}.mdx`
10. For each `not_found`, `credential_required`, or high-value `license_review` candidate, send one concise Slack webhook alert. Include dataset id, candidate name, why it matters, what is missing, URLs checked, and the recommended human action. If Slack delivery fails, record it in `slack_alerts_pending`.
11. Decide what should happen next:
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
- `dataset_briefing.md`
- `raw_inventory.jsonl`
- `raw_inventory.csv`
- `docs/public-datasets/briefings/{datasetId}.md`
- `docs/public-datasets/{datasetId}.mdx`

`improvement_result.json` must include:

```json
{
  "datasetId": "{datasetId}",
  "datasetName": "{datasetName}",
  "status": "completed|blocked",
  "checkedAt": "ISO-8601 timestamp",
  "currentCoverageSummary": {},
  "downloadedSources": [],
  "briefingUpdated": true,
  "docsUpdated": true,
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
