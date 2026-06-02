Canonical admin improvement job for dataset `econ`: add a compact provider-native public Zillow Research housing-data package if currently available from official Zillow Research download surfaces.

Goal:
- Narrow the documented housing and real-estate gap for Zillow/house-price/rent/inventory public data.
- Preserve raw provider-native public files only. Do not build merged panels, derived fields, joins, cleaned datasets, analysis-ready outputs, or synthetic replacements.
- Prefer official Zillow Research downloadable CSVs for core ZHVI/ZORI/inventory/listing or similar housing-market metrics.

Target source family:
- Official Zillow Research data page and official public static CSV assets linked from it.
- Prefer a small high-value set of stable public CSVs, for example national/metro/county/city ZIPs or direct CSVs for ZHVI, ZORI, inventory, new listings, price cuts, or market heat metrics.
- If the public data page moved, discover the current official Zillow URL and record redirects, HTTP status, content type, byte count, SHA-256, and final URL.
- If Zillow no longer exposes public downloadable files, classify candidates as `deferred_fetchable`, `credential_required`, `license_review`, `not_found`, or `reject` with evidence, and do not invent a substitute under the Zillow name.

Dataset/write constraints:
- Use the mounted canonical dataset directory from `$DATASET_MOUNT_PATH` or `/data/datasets/econ`.
- Before downloads, perform an actual create/delete write probe in the dataset root. `test -w` is not enough.
- Store new raw files only under a clear folder such as `raw/zillow_research_<YYYYMMDD>/`.
- Keep archives compressed unless inspection requires streaming members; avoid expanding large archives into many small files.
- Never delete or overwrite existing provider-native raw data.

Required deliverables/artifacts:
- `work.md`: non-empty chronological work log.
- `report.html`: concise HTML report.
- `improvement_result.json`: top-level `status` exactly `completed` or `blocked`, with source classification, URLs attempted, file paths, byte counts, SHA-256 hashes, row/column/time/geography coverage where feasible, and blockers if any.
- `dataset_briefing.md`: the full updated econ briefing, preserving prior documented sources and adding the new Zillow entry only if real public files were landed.
- Inventory artifacts such as `raw_inventory.csv`, `raw_inventory.jsonl`, `download_inventory.csv`, `download_inventory.jsonl`, and `quality_report.md` where feasible.
- Slack/lifecycle artifact(s) if webhook delivery is unavailable or fails, without exposing secrets.

Briefing/profile rules:
- Do not replace the existing broad econ briefing with a narrow Zillow-only briefing.
- Preserve existing inventory markers including `raw/federal_reserve_z1/z1_csv_files_20260319.zip`, `raw/worldbank/WDI_CSV_2026_04_09.zip`, `raw/bis_cpmi/WS_CPMI_CASHLESS_csv_col.zip`, `raw/fannie_mae_hpsi_20260602/`, and `raw/apartment_list_rents_20260602/`.
- If data lands, update the full mounted briefing, docs mirrors if accessible, manifest/profile/quality metadata, and backend profile proof fields with the current execution id.
- Before profile sync, block if `dataset_briefing.md` or `improvement_result.json` contains `Startup placeholder` or `startup_placeholder_not_final`.
- Read the backend profile back and verify it contains the exact updated full briefing and current execution id.
- If validation, profile sync, or readback cannot be proven, mark blocked and preserve the previous full briefing rather than syncing a narrowed or placeholder profile.

Roadmap wording:
- If Zillow Research public CSVs land, update housing roadmap coverage to say Zillow Research is present in part while keeping remaining gaps such as Case-Shiller, Redfin, NAR, Freddie Mac AIMI, broader Fannie Mae products, parcel/assessor data, listings, appraisals, loan-level agency performance data, and licensed datasets explicit.
- Do not claim the econ dataset now literally has all data an economist could need.
