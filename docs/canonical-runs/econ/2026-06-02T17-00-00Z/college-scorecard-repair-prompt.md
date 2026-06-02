# Econ College Scorecard public data repair prompt

Dataset: econ
Timestamp: 2026-06-02T17-00-00Z

Objective: Improve the canonical econ dataset by adding a compact official U.S. Department of Education College Scorecard public data package, filling part of the education/human-capital gap not covered by the existing IPEDS 2024 core slice.

Requirements:
- Work only through the mounted canonical dataset path for dataset econ.
- Use official Department of Education / College Scorecard URLs only, preferably official downloads from collegescorecard.ed.gov or ed-public-download.app.cloud.gov. Do not use mirrors.
- Preserve provider-native files under an appropriate raw/ directory, for example raw/college_scorecard_20260602/.
- Target compact high-value files: most recent institution-level data, data dictionary, and metadata. Avoid expanding all historical cohorts unless small enough and clearly justified.
- Record exact request URLs, canonical provider pages, retrieval times, HTTP status/content type, sizes, SHA-256 hashes, row counts, columns, and coverage.
- Verify payloads are real Scorecard data, not HTML errors or placeholders.
- Update mounted dataset inventory artifacts, manifest/source registry/download inventory/raw inventory/volume inventory where available.
- Write dataset_briefing.md, improvement_result.json, work.md, report.html, and quality_report.md artifacts.
- State limitations clearly: not all historical cohorts, not restricted student microdata, not all IPEDS/NSLDS/earnings microdata, and no derived panels unless actually produced.

Hard stop: if no official valid College Scorecard data can be retrieved, do not promote a placeholder. Report blocked with evidence.
