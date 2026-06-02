# Econ SSA/OASDI public tables repair prompt

Dataset: econ
Timestamp: 2026-06-02T16-45-00Z

Objective: Improve the canonical econ dataset by adding a compact official Social Security Administration OASDI public tables package, filling part of the documented public finance/tax/transfer-system gap for SSA/OASDI tables.

Requirements:
- Work only through the mounted canonical dataset path for dataset econ.
- Use official SSA URLs only, preferably ssa.gov/oact/STATS or other SSA official public statistical table endpoints. Do not use mirrors.
- Preserve provider-native HTML/CSV/PDF/XLS files under an appropriate raw/ directory, for example raw/ssa_oasdi_20260602/.
- Target a compact high-value seed: OASDI beneficiary counts/benefit amounts, trust-fund financial data, covered workers/contributions, or Annual Statistical Supplement tables. Avoid scraping huge site trees.
- Record exact request URLs, canonical provider pages, retrieval times, HTTP status/content type, sizes, SHA-256 hashes, row counts/parsed table counts where measurable, and coverage years/geographies/populations.
- Verify payloads are real SSA data, not HTML errors, bot pages, or placeholders.
- Update mounted dataset inventory artifacts, manifest/source registry/download inventory/raw inventory/volume inventory where available.
- Write dataset_briefing.md, improvement_result.json, work.md, report.html, and quality_report.md artifacts.
- State limitations clearly: public aggregate tables only, not SSA restricted microdata, not full Annual Statistical Supplement, not complete OASDI actuarial data unless actually downloaded.

Hard stop: if no official valid SSA/OASDI data can be retrieved, do not promote a placeholder. Report blocked with evidence.
