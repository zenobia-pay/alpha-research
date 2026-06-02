Canonical admin improvement job for dataset `econ`: add provider-native public FFIEC CDR Call Report bulk data coverage.

This is an admin-owned canonical dataset improvement job, not a user-facing research analysis run. Operate on the mounted canonical dataset volume, preferably using `DATASET_MOUNT_PATH`, and perform an actual create/delete write probe in the dataset root before downloads. If the dataset root is not writable, stop with a precise non-secret blocker.

Goal:
- Fill part of the documented econ gap for historical FFIEC Call Report bulk archives.
- Prefer official FFIEC CDR / FFIEC public disclosure bulk download sources.
- Land a compact, provider-native seed that is useful and verifiable without attempting a full decades-long historical mirror in this run.

Target source:
- Official FFIEC CDR public data distribution / bulk data download page for Call Report data.
- If available, capture the most recent one or two quarterly Call Report bulk ZIP packages and the accompanying metadata, schedule, taxonomy, or user-guide material needed to interpret the package.
- If the latest quarter is unavailable or gated, choose the newest public quarter that returns HTTP 200 from an official FFIEC endpoint.

Constraints:
- Store raw provider files only under a clear folder such as `raw/ffiec_call_report_<YYYYMMDD>/`.
- Do not create merged panels, derived variables, normalized tables, cross-source joins, regressions, or analysis-ready artifacts.
- Preserve provider filenames where practical.
- Capture source URLs, HTTP status, content type, content length when available, byte sizes, SHA-256 hashes, ZIP member names, and basic row/column counts from representative CSV/TXT members when feasible.
- Keep downloaded scope bounded. If full Call Report packages are unexpectedly huge, capture metadata plus a smaller official public package or sample and explain the limitation.
- Do not use credentials, scraped private endpoints, licensed products, or non-public data.

Required artifacts:
- `dataset_briefing.md` containing the full updated econ briefing, preserving prior documented sources and adding the new FFIEC Call Report entry.
- `improvement_result.json` with execution id, dataset id, source classification, files landed, byte/hash evidence, and limitations.
- `quality_report.md` describing write probe result, source verification, inventory checks, and any blockers.
- A raw/download inventory artifact such as `raw_inventory.csv`, `download_inventory.csv`, or equivalent.
- `report.html` summarizing what changed.

Profile/docs expectations:
- Update the dataset profile/quality metadata so `canonical:dataset -- status --dataset-id econ` can show this execution as disk-inventory proof.
- The final status should be suitable for local validation with `npm run canonical:dataset -- validate --dataset-id econ --execution-id <execution-id>`: required runtime artifacts present, `diskInventoryProven` true, and profile readback tied to this execution id.
- Do not replace the existing broad econ briefing with a narrow FFIEC-only briefing. Preserve existing source bullets and limitations, and add/update only the relevant credit/banking roadmap line.
