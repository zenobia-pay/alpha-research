Canonical admin improvement job for dataset `econ`: add one compact, high-value official/public BEA regional economics package that directly reduces the documented deeper regional accounts/local-area coverage gap.

Scope:
- This is an admin-owned canonical dataset improvement job, not a user-facing research analysis run.
- Use the mounted canonical dataset volume, preferably `DATASET_MOUNT_PATH`.
- Before downloads or profile edits, perform an actual create/write/delete probe in the dataset root. If the probe fails, stop and report `dataset_dir_not_writable` with the exact non-secret filesystem error.
- Target official/public U.S. Bureau of Economic Analysis regional data only. Prefer BEA Regional data ZIPs or direct CSV/TXT packages for county/local-area personal income, employment, GDP, or related regional tables from `apps.bea.gov` or `bea.gov`.
- Keep the job focused. Add one coherent provider-native package under `raw/bea_regional_local_area_<capture-date>/`.
- Do not use API keys, credentials, commercial mirrors, derived panels, joins, or model-ready transformations.

Storage and data rules:
- Preserve provider/source-native files where practical: ZIP, CSV, TXT, XLS/XLSX, PDF, HTML, or metadata snapshots.
- It is acceptable to create small metadata, inventory, source-summary, table-index, and file-level provenance files that make the source navigable.
- Do not create merged panels, cross-source joins, model-ready features, or analysis-ready regional indicators beyond faithful source inventories.

Required provenance:
- Record source URLs, final URLs after redirects, HTTP status, content type, Last-Modified/ETag when present, byte counts, SHA-256 hashes, retrieval timestamp, and provider/license/access notes.
- For each selected table/file, record what the records represent, geography, time coverage, frequency, row/column counts when measurable, key fields, units, and caveats.
- Record whether files are provider-native and what small helper files were generated.

Required artifacts:
- `dataset_briefing.md`: a full updated dataset inventory briefing that preserves all prior inventory bullets and adds the new BEA regional/local-area entry near the top.
- `improvement_result.json`: structured result with dataset id, raw directory, files, hashes, row counts, source URLs, license/access notes, and limitations.
- `raw_inventory.jsonl` and `raw_inventory.csv`: file-level inventory for the added package.
- `candidate_sources.csv`: include considered BEA regional/local-area pages/files and why the selected package was used.
- `work.md`: concise execution notes, including write-probe result.
- Updated docs mirrors for `docs/public-datasets/briefings/econ.md` and `docs/public-datasets/econ.mdx`.

Profile/readback:
- Update the canonical dataset profile/briefing to the full updated inventory, not a narrow briefing that drops older entries.
- Before profile update, verify `dataset_briefing.md` and `improvement_result.json` do not contain `Startup placeholder` or `startup_placeholder_not_final`.
- If the run blocks after startup, recover the existing full briefing and use it as final `dataset_briefing.md`; do not leave placeholder artifacts.
- Read the profile back after update and verify it remains `disk_proven`, `writeReady: true`, and tied to this execution id.
- Preserve roadmap limitation language. Mark BEA regional/local-area coverage as present in part only; do not claim full historical regional accounts, every BEA table, or complete microdata coverage.

Slack/status:
- Keep any Slack briefing concise and non-secret. Do not include tokens, webhook URLs, auth headers, cookies, or secret material.
