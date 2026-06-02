# Econ BEA regional/local-area repair prompt

Dataset: econ
Timestamp: 2026-06-02T16-36-00Z

Objective: Improve the canonical econ dataset by adding a compact, official, provider-native BEA regional/local-area income/employment source package that fills the documented gap for broader BEA regional-account tables.

Requirements:
- Work only through the mounted canonical dataset path for dataset econ.
- Prefer official BEA provider URLs/API/downloads. Do not use mirrors.
- Target compact high-value regional/local-area public data, such as BEA Regional CAINC/CAEMP/SAINC/SAEMP packages or equivalent current official BEA local-area personal income/employment data.
- Preserve raw provider-native files under an appropriate raw/ directory, for example raw/bea_regional/.
- Record exact request URLs, canonical provider pages if available, retrieval times, HTTP status/content type, sizes, SHA-256 hashes, row counts, columns, and coverage.
- Verify payloads are real data, not HTML/JSON error bodies or access-denied placeholders.
- Update mounted dataset inventory artifacts, manifest/source registry/download inventory/raw inventory/volume inventory where available.
- Write dataset_briefing.md, improvement_result.json, work.md, report.html, and quality_report.md artifacts.
- State limitations clearly: this is a seed/regional slice, not the complete BEA regional accounts universe, not restricted microdata, and not normalized panels unless actually produced.

Hard stop: if no official valid BEA regional/local-area package can be retrieved, do not promote a placeholder. Report blocked with evidence.
