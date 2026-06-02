# Econ HMDA 2022-2023 Snapshot Prompt

Dataset: `econ`
Timestamp: 2026-06-02T19:45:00Z

Objective: Improve the canonical econ dataset by adding official FFIEC/CFPB HMDA Snapshot National Loan-Level Dataset packages for 2023 and 2022, extending the existing 2024 HMDA coverage backward across more of the mortgage-rate cycle.

Run this as an admin-owned canonical dataset improvement job. Work only through the mounted canonical dataset path for `econ`, preferably `DATASET_MOUNT_PATH`. Do not start a user-facing research run.

Target only these official static file-server URLs, all preflighted with HTTP 200 on 2026-06-02:

- `https://files.ffiec.cfpb.gov/static-data/snapshot/2023/2023_public_lar_csv.zip`
- `https://files.ffiec.cfpb.gov/static-data/snapshot/2023/2023_public_ts_csv.zip`
- `https://files.ffiec.cfpb.gov/static-data/snapshot/2023/2023_public_msamd_csv.zip`
- `https://files.ffiec.cfpb.gov/static-data/snapshot/2022/2022_public_lar_csv.zip`
- `https://files.ffiec.cfpb.gov/static-data/snapshot/2022/2022_public_ts_csv.zip`
- `https://files.ffiec.cfpb.gov/static-data/snapshot/2022/2022_public_msamd_csv.zip`

Requirements:

- Before downloads or profile work, prove the mounted dataset root is writable with an actual create/delete probe. If that fails, block with `dataset_dir_not_writable` or the exact non-secret filesystem error.
- Preserve raw provider-native ZIP files under `raw/hmda_2022_2023_snapshot/`.
- Keep the huge `public_lar` CSVs compressed. Do not extract full LAR files to disk. Use ZIP central-directory metadata and streaming sample/header reads for row and column counts where feasible.
- For each ZIP, record exact request URL, retrieval timestamp, HTTP status, content type, content length, Last-Modified, ETag, final saved byte size, SHA-256, ZIP member names, member compressed/uncompressed sizes, row counts, column counts, and date/year coverage when measurable.
- Verify payloads are ZIP files with real CSV members, not HTML/XML/JSON error pages or access-denied placeholders.
- Update mounted dataset inventory artifacts, manifest/source registry/download inventory/raw inventory/volume inventory where available.
- Write required artifacts: `dataset_briefing.md`, `improvement_result.json`, `work.md`, `report.html`, and `quality_report.md`.
- Update the CLI-visible backend profile from the final full `dataset_briefing.md`, and read it back to prove `diskInventoryProven: true`, the current execution id, no startup placeholder, and preservation of the existing econ inventory markers.
- Keep the final briefing conservative: add exactly one HMDA 2022-2023 snapshot bullet if valid files land. Preserve all prior econ source bullets and limitations. Do not claim full HMDA history; explicitly note that 2021 and earlier vintages, dynamic API slices, documentation breadth, and restricted mortgage/credit datasets remain incomplete unless actually downloaded.

Hard stop: if a target URL fails, skip that file with evidence. If no valid HMDA ZIP lands, do not promote a placeholder; write a blocked result with the attempted URLs and statuses.
