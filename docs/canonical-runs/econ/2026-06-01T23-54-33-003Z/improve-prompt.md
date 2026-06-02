Canonical admin improvement job for dataset `econ`: add one compact, high-value official public macro source package that directly reduces the documented ONS balance-of-payments / international-investment-position gap.

Scope:
- This is an admin-owned canonical dataset improvement job, not a user-facing research analysis run.
- Use the mounted canonical dataset volume, preferably `DATASET_MOUNT_PATH`.
- Before downloads or profile edits, perform an actual create/write/delete probe in the dataset root. If the probe fails, stop and report `dataset_dir_not_writable` with the exact non-secret filesystem error.
- Target only official UK Office for National Statistics public source files for balance of payments and/or international investment position. Prefer current ONS provider-native downloadable files such as balance of payments quarterly/current account/IIP reference tables or time-series packages. Do not use unofficial mirrors.
- Keep the job focused. Add one coherent ONS BoP/IIP package or a small set of directly companion files. Avoid broad ONS catalog crawling.

Storage and data rules:
- Store provider-native raw files under a new stable raw directory such as `raw/ons_balance_of_payments_iip_<release-or-capture-date>/`.
- Preserve original filenames where practical.
- Do not create merged panels, derived fields, cross-source joins, normalized analytical tables, or analysis-ready artifacts.
- It is acceptable to create small metadata, inventory, and sheet-summary files that document provenance and coverage.
- Avoid expanding large archives into many small files unless required for inspection.

Required provenance:
- Record source URLs, final URLs after redirects, HTTP status, content type, Last-Modified/ETag when present, byte counts, SHA-256 hashes, retrieval timestamp, and provider license/terms.
- For ZIP/XLS/XLSX/CSV files, inspect enough structure to report member/sheet names, row/column counts, period coverage, geographic coverage, key economic concepts, and units where visible.
- Record whether files are provider-native and whether any transformations were avoided.

Required artifacts:
- `dataset_briefing.md`: a full updated dataset inventory briefing that preserves all prior inventory bullets and adds the new ONS BoP/IIP entry near the top.
- `improvement_result.json`: structured result with dataset id, raw directory, files, hashes, row/sheet/member counts, source URLs, license, and limitations.
- `raw_inventory.jsonl` and `raw_inventory.csv`: file-level inventory for the added package.
- `candidate_sources.csv`: include the considered ONS candidates and explain why the selected package was used.
- `work.md`: concise execution notes, including write-probe result and any blocked candidates.
- Updated docs mirrors for `docs/public-datasets/briefings/econ.md` and `docs/public-datasets/econ.mdx`.

Profile/readback:
- Update the canonical dataset profile/briefing to the full updated inventory, not a narrow briefing that drops older entries.
- Read the profile back after update and verify it remains `disk_proven`, `writeReady: true`, and tied to this execution id.
- Preserve the roadmap limitation language. Mark ONS balance-of-payments/IIP as present in part only if a real package lands; do not claim full ONS coverage, regional accounts, Blue Book revision histories, or full ONS API/catalog completion.

Slack/status:
- Keep any Slack briefing concise and non-secret. Do not include tokens, webhook URLs, auth headers, or secret material.
