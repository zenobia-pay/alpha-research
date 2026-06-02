Canonical admin repair job for dataset `econ`: validate and promote the already-downloaded BEA regional/local-area package by regenerating a full inventory briefing that preserves every existing econ inventory entry.

Scope:
- This is an admin-owned canonical dataset repair job, not a user-facing research analysis run.
- Use the mounted canonical dataset volume, preferably `DATASET_MOUNT_PATH`.
- Before any mutation or profile edit, perform an actual create/write/delete probe in the dataset root. If the probe fails, stop and report `dataset_dir_not_writable` with the exact non-secret filesystem error.
- Do not redownload BEA data unless the files are missing or corrupt. The prior run `00486c4b-5624-4e6e-88ee-a868a74101a9` indicated the package is already on disk under `raw/bea_regional_local_area_20260602/`.
- Inspect and verify only the existing BEA package, then rebuild the full `dataset_briefing.md`, docs mirrors, and backend profile from the complete current econ inventory.

Expected BEA package facts to verify from disk:
- `raw/bea_regional_local_area_20260602/CAINC30.zip`: expected size about 23,503,703 bytes; expected SHA-256 `29945d32e31ef53e03907d282016156bcb946705583a9f8790d687d7da1bba63`; expected member `CAINC30__ALL_AREAS_1969_2024.csv`; expected 73,811 rows x 64 columns; annual 1969-2024 local-area/county/MSA personal-income components in current dollars.
- `raw/bea_regional_local_area_20260602/CAEMP25N.zip`: expected size about 11,050,299 bytes; expected SHA-256 `b36723a57080fce5a1020e63f898f2ceaa35d06bb01a454d4f643722cf6dca6b`; expected member `CAEMP25N__ALL_AREAS_2001_2022.csv`; expected 104,878 rows x 30 columns; annual 2001-2022 county employment counts in persons.
- Existing metadata/inventory files may include `metadata.json`, `raw_inventory.csv`, `raw_inventory.jsonl`, `raw_inventory_summary.csv`, and `raw_inventory_summary.json`.

Hard preservation requirements:
- The final `dataset_briefing.md` must be the full current econ inventory plus one BEA regional/local-area bullet near the top. It must not be a narrow BEA-only or WDI-only briefing.
- The final briefing must contain these existing markers before any profile update:
  - `raw/federal_reserve_z1/z1_csv_files_20260319.zip`
  - `raw/worldbank/WDI_CSV_2026_04_09.zip`
  - `raw/bis_cpmi/WS_CPMI_CASHLESS_csv_col.zip`
  - `raw/ons_bop_iip_20260602`
  - `raw/sec_edgar_bulk`
- Before profile update, verify `dataset_briefing.md` and `improvement_result.json` do not contain `Startup placeholder` or `startup_placeholder_not_final`.
- `improvement_result.json` must use top-level `"status": "completed"` only after the full briefing, docs mirrors, and profile readback are proven. Use `"status": "blocked"` for any failure; never leave `"status": "in_progress"` in the final artifact.

Required artifacts:
- `dataset_briefing.md`: full updated inventory, preserving all prior bullets and adding the BEA regional/local-area entry.
- `improvement_result.json`: structured completed/blocked result with dataset id, raw directory, verified files, hashes, row counts, source URLs, license/access notes, limitations, profile readback status, and exact blockers if any.
- `raw_inventory.jsonl` and `raw_inventory.csv`: BEA package file-level inventory or copy from the verified package.
- `candidate_sources.csv`: explain that this is a repair/promotion run for the existing BEA package and note any BEA candidate links that remain pending.
- `work.md`: concise execution notes, including write-probe result and marker checks.
- Updated docs mirrors for `docs/public-datasets/briefings/econ.md` and `docs/public-datasets/econ.mdx`.

Profile/readback:
- Update the backend dataset profile from the exact final `dataset_briefing.md` body:
  - `briefingMarkdown`: exact final briefing
  - `profile.quality.diskInventoryProven`: `true`
  - `profile.quality.volumeInventoryRunId`: current remote execution id
  - `profile.quality.volumeInventoryUpdatedAt`: current ISO timestamp
  - `describedRunId`: current remote execution id
  - `describedAt`: current ISO timestamp
- Read the profile back after update and verify:
  - status is `disk_proven`
  - `writeReady` is true
  - profile run id equals the current execution id
  - briefing contains the BEA package marker and all existing required markers above

Slack/status:
- Keep any Slack briefing concise and non-secret. Do not include tokens, webhook URLs, auth headers, cookies, or secret material.
