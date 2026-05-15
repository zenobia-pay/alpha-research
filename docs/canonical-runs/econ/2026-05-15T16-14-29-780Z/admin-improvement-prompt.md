# Canonical Dataset Improvement Job: Econ (econ)

Run an admin-owned canonical improvement job for the public economics dataset `econ`.

## Goal

Prioritize adding public raw source coverage for two missing research families:

1. Tenant-protection law panel sources for eviction moratoria, rent control/rent stabilization, just-cause eviction laws, right-to-counsel, security deposit caps, source-of-income protections, anti-rent-gouging laws, eviction record sealing, and related policy dates/jurisdictions.
2. Government employment protection sources covering civil-service protections, public-sector collective bargaining laws, union membership/coverage, dismissal difficulty, appeal rights, agency performance, absenteeism, complaints, disciplinary actions, and firing/termination rates.

Also search for raw public outcome/proxy sources that help pair these policies with behavior or market responses: eviction filings/judgments, rents, prices, permits, vacancies, screening proxies, complaints, disciplinary actions, absenteeism, and termination/firing rates.

## Canonical Dataset Rules

- Treat this as an admin canonical improvement job, not a user-facing research run.
- Use the mounted dataset volume for `econ`; prefer `DATASET_MOUNT_PATH`, otherwise `/mnt/alpha-research/datasets/econ`.
- Canonical datasets are raw public source packages. Do not publish merged panels, processed tables, derived treatment variables, cross-source joins, shared entity models, or analysis-ready outputs as canonical artifacts.
- If a source is public, stable, relevant, machine-fetchable, and worth adding, download the raw provider files/API responses into source-specific raw paths and record provenance.
- If a public source is promising but license/terms are unclear, download only when allowed by canonical policy, mark it `license_review` / `license_status: needs_review`, and make redistribution caveats explicit.
- If a source is credentialed, paid, anti-bot protected, private, unstable, or lacks a stable endpoint, do not ingest it; record the blocker and next route.
- Never write secrets, webhook URLs, API keys, cookies, bearer tokens, or presigned URLs into artifacts or logs.

## Required Work

1. Create runtime artifacts `work.md` and `report.html` immediately, and keep `work.md` current.
2. Inspect existing `econ` files, inventories, registry, manifest, briefing, quality report, and docs mirrors.
3. Search for and classify candidate sources relevant to the two focus areas. Include NLIHC tenant protection sources, Eviction Lab/ETS or equivalent eviction court data, Legal Services Corporation eviction data, NBER public-sector collective bargaining data, BLS/CPS public-sector union data, NCSL public-sector collective bargaining data, and any stronger public machine-fetchable sources found during research.
4. For every candidate, classify exactly one of: `active_fetchable`, `deferred_fetchable`, `license_review`, `credential_required`, `not_found`, or `reject`.
5. Download high-value `active_fetchable` and allowed `license_review` sources. Preserve native files and API responses; do not normalize into a panel.
6. Update `download_inventory.jsonl`/`.csv`, `raw_inventory.jsonl`/`.csv`, `manifest.json`, `source_registry.csv`, `source_registry.plan.json`, `data_dictionary.md`, `quality_report.md`, and `dataset_briefing.md`.
7. Mirror the final briefing to `docs/public-datasets/briefings/econ.md` and `docs/public-datasets/econ.mdx`.
8. Update the CLI-visible dataset profile from the same briefing, including sources/tables/quality fields, and read back to verify.
9. Send the canonical Slack briefing if `CANONICAL_DATASET_SLACK_WEBHOOK_URL` is available; if delivery fails or is unavailable, write the pending payload and non-secret reason.

## Required Outputs

Write these artifacts:

- `improvement_plan.md`
- `improvement_result.json`
- `candidate_sources.csv`
- `exa_search_log.json`
- `slack_briefing.md`
- `dataset_briefing.md`
- `raw_inventory.jsonl`
- `raw_inventory.csv`
- `docs/public-datasets/briefings/econ.md`
- `docs/public-datasets/econ.mdx`
- `work.md`
- `report.html`

`improvement_result.json` must include dataset id/name, status, checkedAt, downloadedSources, downloadedLicenseReviewSources, briefing/docs/profile update booleans, searchesPerformed, promoteNow, defer, needsHumanReview, rejected, downloadAttempts, Slack sent/pending state, diskInventoryProven, and nextRunHints.

Return a concise final status with execution outcome, new sources downloaded, deferred/rejected sources, files written, profile readback status, Slack status, and whether disk inventory was proven.
