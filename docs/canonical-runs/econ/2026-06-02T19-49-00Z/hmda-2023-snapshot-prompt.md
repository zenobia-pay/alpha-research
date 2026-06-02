# Econ HMDA 2023 Snapshot Prompt

Dataset: `econ`
Timestamp: 2026-06-02T19:49:00Z

Objective: Add one official FFIEC/CFPB HMDA Snapshot National Loan-Level Dataset year, 2023, to extend the existing 2024 HMDA coverage backward.

Important: Do not stop after creating startup artifacts. The startup placeholder is only a safety file for artifact capture; continue to the dataset work below.

Target official static file-server URLs, preflighted with HTTP 200 on 2026-06-02:

- `https://files.ffiec.cfpb.gov/static-data/snapshot/2023/2023_public_lar_csv.zip`
- `https://files.ffiec.cfpb.gov/static-data/snapshot/2023/2023_public_ts_csv.zip`
- `https://files.ffiec.cfpb.gov/static-data/snapshot/2023/2023_public_msamd_csv.zip`

Requirements:

- Work only through the mounted canonical dataset path for `econ`; do not start a user-facing research run.
- Prove the dataset root is writable with an actual create/delete probe before downloads.
- Save provider ZIPs under `raw/hmda_2023_snapshot/`.
- Keep the LAR ZIP compressed; do not extract the full LAR CSV to disk.
- Verify each saved file is a ZIP with CSV member(s), not an error page.
- Record request URL, HTTP metadata, bytes, SHA-256, ZIP member names/sizes, row counts, column counts, and coverage.
- Update inventories and write required artifacts including full non-placeholder `dataset_briefing.md`, `improvement_result.json`, `work.md`, `report.html`, and `quality_report.md`.
- Update backend profile from the full briefing and read it back.
- If the download or finalization fails, preserve the existing full econ briefing as the final artifact and report the exact non-secret blocker.

Final briefing should add one conservative `raw/hmda_2023_snapshot/` bullet only if real files land. Do not claim full HMDA history.
