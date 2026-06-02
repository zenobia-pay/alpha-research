Canonical admin improvement job for dataset `econ`: add one compact, high-value official/public Social Security transfer-system statistics package that directly reduces the documented SSA/OASDI public tables gap.

Scope:
- This is an admin-owned canonical dataset improvement job, not a user-facing research analysis run.
- Use the mounted canonical dataset volume, preferably `DATASET_MOUNT_PATH`.
- Before downloads or profile edits, perform an actual create/write/delete probe in the dataset root. If the probe fails, stop and report `dataset_dir_not_writable` with the exact non-secret filesystem error.
- Target official/public U.S. Social Security Administration statistical material only: OASDI Trustees Report tables, Annual Statistical Supplement tables, beneficiary/payment counts, covered workers, benefits, trust fund finances, or related public SSA downloadable tables.
- Keep the job focused. Add one coherent provider-native package under `raw/ssa_oasdi_public_tables_<capture-date>/`.
- Do not use restricted SSA microdata, claimant files, PII, scraped account pages, or credentials. Do not infer individual-level outcomes.

Storage and data rules:
- Preserve provider/source-native files where practical: HTML, PDF, CSV, XLS/XLSX, ZIP, or text snapshots.
- It is acceptable to create small metadata, inventory, source-summary, table-index, and file-level provenance files that make the source navigable.
- Do not create merged panels, cross-source joins, model-ready features, or analysis-ready benefits simulations.

Required provenance:
- Record source URLs, final URLs after redirects, HTTP status, content type, Last-Modified/ETag when present, byte counts, SHA-256 hashes, retrieval timestamp, and provider/license/access notes.
- For each selected table/file, record what the records represent, geography, time coverage, frequency, row/column counts when measurable, key fields, and caveats.
- Record whether files are provider-native and what small helper files were generated.

Required artifacts:
- `dataset_briefing.md`: a full updated dataset inventory briefing that preserves all prior inventory bullets and adds the new SSA/OASDI entry near the top.
- `improvement_result.json`: structured result with dataset id, raw directory, files, hashes, row counts, source URLs, license/access notes, and limitations.
- `raw_inventory.jsonl` and `raw_inventory.csv`: file-level inventory for the added package.
- `candidate_sources.csv`: include considered SSA/OASDI pages/files and why the selected package was used.
- `work.md`: concise execution notes, including write-probe result.
- Updated docs mirrors for `docs/public-datasets/briefings/econ.md` and `docs/public-datasets/econ.mdx`.

Profile/readback:
- Update the canonical dataset profile/briefing to the full updated inventory, not a narrow briefing that drops older entries.
- Before profile update, verify `dataset_briefing.md` and `improvement_result.json` do not contain `Startup placeholder` or `startup_placeholder_not_final`.
- Read the profile back after update and verify it remains `disk_proven`, `writeReady: true`, and tied to this execution id.
- Preserve roadmap limitation language. Mark SSA/OASDI public transfer-system tables as present in part only; do not claim full restricted SSA microdata, full claims records, or complete public-finance coverage.

Slack/status:
- Keep any Slack briefing concise and non-secret. Do not include tokens, webhook URLs, auth headers, cookies, or secret material.
