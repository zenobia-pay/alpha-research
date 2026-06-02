Canonical admin improvement job for dataset `econ`: repair/add provider-native public Redfin Data Center housing-market data if currently available from official Redfin public download surfaces.

Goal:
- Narrow the documented housing and real-estate gap for Redfin public market data.
- Previous audit found `raw/redfin/redfin_market_trends.csv` was an S3 AccessDenied XML response, so do not promote that placeholder. Replace/repair only if a real public CSV can be fetched from official Redfin surfaces.
- Preserve raw provider-native public files only. Do not build merged panels, derived fields, joins, cleaned datasets, analysis-ready outputs, or synthetic replacements.

Target source family:
- Official Redfin Data Center pages and official public downloadable CSV/ZIP assets linked from them.
- Prefer compact stable public CSVs for market trends, city/county/metro/state housing market data, sale/list price, inventory, days on market, listings, pending sales, or similar Redfin Data Center measures.
- If the public data page moved, discover the current official Redfin URL and record redirects, HTTP status, content type, byte count, SHA-256, and final URL.
- If Redfin public files are blocked or no longer public, classify candidates as `deferred_fetchable`, `credential_required`, `license_review`, `not_found`, or `reject` with evidence, preserve the prior full briefing, and do not invent a substitute under the Redfin name.

Dataset/write constraints:
- Use the mounted canonical dataset directory from `$DATASET_MOUNT_PATH` or `/data/datasets/econ`.
- Before downloads, perform an actual create/delete write probe in the dataset root. `test -w` is not enough.
- Store new raw files only under a clear folder such as `raw/redfin_market_data_<YYYYMMDD>/` or repair `raw/redfin/` only if replacing an AccessDenied placeholder with real Redfin CSV data is safe and fully documented.
- Keep archives compressed unless inspection requires streaming members; avoid expanding large archives into many small files.
- Never delete or overwrite existing provider-native raw data except to quarantine/replace the known Redfin AccessDenied placeholder with clear audit evidence.

Required deliverables/artifacts:
- `work.md`: non-empty chronological work log.
- `report.html`: concise HTML report.
- `improvement_result.json`: top-level `status` exactly `completed` or `blocked`, with source classification, URLs attempted, file paths, byte counts, SHA-256 hashes, row/column/time/geography coverage where feasible, and blockers if any.
- `dataset_briefing.md`: the full updated econ briefing, preserving prior documented sources and adding a Redfin entry only if real public files were landed.
- Inventory artifacts such as `raw_inventory.csv`, `raw_inventory.jsonl`, `download_inventory.csv`, `download_inventory.jsonl`, and `quality_report.md` where feasible.
- Slack/lifecycle artifact(s) if webhook delivery is unavailable or fails, without exposing secrets.

Briefing/profile rules:
- Do not replace the existing broad econ briefing with a narrow Redfin-only briefing.
- Preserve existing inventory markers including `raw/federal_reserve_z1/z1_csv_files_20260319.zip`, `raw/worldbank/WDI_CSV_2026_04_09.zip`, `raw/bis_cpmi/WS_CPMI_CASHLESS_csv_col.zip`, `raw/fannie_mae_hpsi_20260602/`, `raw/apartment_list_rents_20260602/`, and `raw/zillow_research_20260602/`.
- If data lands, update the full mounted briefing, docs mirrors if accessible, manifest/profile/quality metadata, and backend profile proof fields with the current execution id.
- Before profile sync, block if `dataset_briefing.md` or `improvement_result.json` contains `Startup placeholder` or `startup_placeholder_not_final`.
- Read the backend profile back and verify it contains the exact updated full briefing and current execution id.
- If validation, profile sync, or readback cannot be proven, mark blocked and preserve the previous full briefing rather than syncing a narrowed or placeholder profile.

Roadmap wording:
- If Redfin public data lands, update housing roadmap coverage to say Redfin Data Center is present in part while keeping remaining gaps such as Case-Shiller, NAR, Freddie Mac AIMI, broader Zillow metrics/geographies, Fannie Mae survey microdata, parcel/assessor data, listings, appraisals, loan-level agency performance data, and licensed datasets explicit.
- If Redfin remains blocked, keep Redfin as absent and record the exact non-secret blocker in the maintenance summary.
- Do not claim the econ dataset now literally has all data an economist could need.
