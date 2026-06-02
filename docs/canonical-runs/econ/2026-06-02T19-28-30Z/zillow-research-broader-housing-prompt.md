# Econ Zillow Research Broader Housing Prompt

Dataset: `econ`
Timestamp: 2026-06-02T19:28:30Z

Objective: Improve the canonical econ dataset by adding a compact official Zillow Research public CSV package that broadens the current Zillow coverage beyond the existing metro single-family ZHVI seed.

Run this as an admin-owned canonical dataset improvement job. Work only through the mounted canonical dataset path for `econ`, preferably `DATASET_MOUNT_PATH`. Do not start a user-facing research run.

Target official Zillow Research public CSV URLs that were preflighted with HTTP 200 on 2026-06-02:

- `https://files.zillowstatic.com/research/public_csvs/zori/Metro_zori_uc_sfrcondomfr_sm_month.csv`
- `https://files.zillowstatic.com/research/public_csvs/zhvi/County_zhvi_uc_sfr_tier_0.33_0.67_sm_sa_month.csv`
- `https://files.zillowstatic.com/research/public_csvs/invt_fs/Metro_invt_fs_uc_sfrcondo_sm_month.csv`
- `https://files.zillowstatic.com/research/public_csvs/sales_count_now/Metro_sales_count_now_uc_sfrcondo_month.csv`

Requirements:

- Before downloads or profile work, prove the mounted dataset root is writable with an actual create/delete probe. If that fails, block with `dataset_dir_not_writable` or the exact non-secret filesystem error.
- Preserve raw provider-native files under a clear folder such as `raw/zillow_research_broader_20260602/`.
- Download only real Zillow CSV payloads from the official `files.zillowstatic.com/research/public_csvs/` URLs above. Do not use unofficial mirrors, browser automation workarounds, or scraped pages.
- For each file, record exact request URL, retrieval timestamp, HTTP status, content type, content length, Last-Modified, ETag, final saved byte size, SHA-256, row count, column count, identifier columns, date coverage, and geography level.
- Verify payloads are CSV data, not HTML/XML/JSON error pages or access-denied placeholders.
- Update mounted dataset inventory artifacts, manifest/source registry/download inventory/raw inventory/volume inventory where available.
- Write required artifacts: `dataset_briefing.md`, `improvement_result.json`, `work.md`, `report.html`, and `quality_report.md`.
- Update the CLI-visible backend profile from the final full `dataset_briefing.md`, and read it back to prove `diskInventoryProven: true`, the current execution id, no startup placeholder, and preservation of the existing econ inventory markers.
- Keep the final briefing conservative: add exactly one Zillow broader-housing bullet if valid files land. Preserve all prior econ source bullets and limitations. Do not claim full Zillow coverage; explicitly note that this remains a compact subset and that city/ZIP/rental/listing/market-heat/price-cut metrics and licensed real-estate datasets remain incomplete unless actually downloaded.

Hard stop: if any target URL fails, skip that file with evidence. If no valid Zillow CSV lands, do not promote a placeholder; write a blocked result with the attempted URLs and statuses.
