Canonical admin improvement job for dataset `econ`: add provider-native public Fannie Mae housing sentiment / National Housing Survey data.

This is an admin-owned canonical dataset improvement job, not a user-facing research analysis run. Operate on the mounted canonical dataset volume, preferably using `DATASET_MOUNT_PATH`, and perform an actual create/delete write probe in the dataset root before downloads. If the dataset root is not writable, stop with a precise non-secret blocker.

Goal:
- Fill part of the documented housing and real-estate gap for Fannie Mae surveys.
- Prefer official Fannie Mae National Housing Survey, Home Purchase Sentiment Index (HPSI), or related public housing-sentiment data downloads.
- Land a compact provider-native public source package that is useful for housing-demand, expectations, mortgage-credit, and consumer-sentiment research.

Target source:
- Official Fannie Mae Research / National Housing Survey / HPSI data page and direct public downloadable files.
- Capture the current public HPSI historical data file if available, plus methodology or data dictionary material needed to interpret the index and component questions.
- If the direct data file moved, use the current official Fannie Mae page to discover the public asset. If only a spreadsheet or PDF/document package is available, preserve it provider-native and document that format.

Constraints:
- Store raw provider files only under a clear folder such as `raw/fannie_mae_hpsi_<YYYYMMDD>/`.
- Do not create merged panels, derived variables, normalized tables, cross-source joins, regressions, or analysis-ready artifacts.
- Preserve provider filenames where practical.
- Capture source URLs, HTTP status, content type, content length when available, byte sizes, SHA-256 hashes, row/column counts where parseable, header names, date range, index/component fields, and access/usage notes.
- Do not use credentials, private endpoints, licensed products, or non-public data.

Required artifacts:
- `dataset_briefing.md` containing the full updated econ briefing, preserving prior documented sources and adding the new Fannie Mae housing-sentiment entry.
- `improvement_result.json` with execution id, dataset id, source classification, files landed, byte/hash evidence, and limitations.
- `quality_report.md` describing write probe result, source verification, inventory checks, and any blockers.
- A raw/download inventory artifact such as `raw_inventory.csv`, `download_inventory.csv`, or equivalent.
- `report.html` summarizing what changed.

Profile/docs expectations:
- Update the dataset profile/quality metadata so `canonical:dataset -- status --dataset-id econ` can show this execution as disk-inventory proof.
- The final status should be suitable for local validation with `npm run canonical:dataset -- validate --dataset-id econ --execution-id <execution-id>`: required runtime artifacts present, `diskInventoryProven` true, and profile readback tied to this execution id.
- Do not replace the existing broad econ briefing with a narrow Fannie Mae-only briefing. Preserve existing source bullets and limitations, and add/update only the relevant housing roadmap line.
