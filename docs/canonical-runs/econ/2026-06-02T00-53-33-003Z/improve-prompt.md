Canonical admin improvement job for dataset `econ`: add one compact, high-value official/public business-cycle metadata source that directly reduces the documented richer NBER business-cycle/source-metadata gap.

Scope:
- This is an admin-owned canonical dataset improvement job, not a user-facing research analysis run.
- Use the mounted canonical dataset volume, preferably `DATASET_MOUNT_PATH`.
- Before downloads or profile edits, perform an actual create/write/delete probe in the dataset root. If the probe fails, stop and report `dataset_dir_not_writable` with the exact non-secret filesystem error.
- Target official/public NBER business-cycle metadata only: NBER US business cycle peak/trough dates and source/methodology pages, plus compact supporting public pages or CSV/HTML/PDF evidence where official. Do not scrape broad NBER working-paper catalogs.
- Keep the job focused. Add one coherent package under `raw/nber_business_cycle_dates_<capture-date>/`.

Storage and data rules:
- Preserve provider/source-native files where practical: HTML, CSV, PDF, or text snapshots.
- It is acceptable to create small metadata, normalized calendar CSV, inventory, and source-summary files that document provenance and make the source navigable.
- Do not create merged panels, cross-source joins, model-ready features, or analysis-ready macro labels beyond a faithful NBER peak/trough calendar representation.

Required provenance:
- Record source URLs, final URLs after redirects, HTTP status, content type, Last-Modified/ETag when present, byte counts, SHA-256 hashes, retrieval timestamp, and provider/license/access notes.
- If extracting the recession calendar, record peak month, trough month, contraction duration, expansion duration when available, and source table/HTML evidence.
- Record whether files are provider-native and what small helper files were generated.

Required artifacts:
- `dataset_briefing.md`: a full updated dataset inventory briefing that preserves all prior inventory bullets and adds the new NBER business-cycle entry near the top.
- `improvement_result.json`: structured result with dataset id, raw directory, files, hashes, row counts, source URLs, license/access notes, and limitations.
- `raw_inventory.jsonl` and `raw_inventory.csv`: file-level inventory for the added package.
- `candidate_sources.csv`: include considered NBER pages/files and why the selected package was used.
- `work.md`: concise execution notes, including write-probe result.
- Updated docs mirrors for `docs/public-datasets/briefings/econ.md` and `docs/public-datasets/econ.mdx`.

Profile/readback:
- Update the canonical dataset profile/briefing to the full updated inventory, not a narrow briefing that drops older entries.
- Read the profile back after update and verify it remains `disk_proven`, `writeReady: true`, and tied to this execution id.
- Preserve roadmap limitation language. Mark richer NBER business-cycle/source metadata as present in part only; do not claim full historical macro vintage coverage or full NBER source catalog completion.

Slack/status:
- Keep any Slack briefing concise and non-secret. Do not include tokens, webhook URLs, auth headers, or secret material.
