Canonical admin improvement job for dataset `econ`: add provider-native public Freddie Mac Primary Mortgage Market Survey (PMMS) weekly mortgage-rate data.

This is an admin-owned canonical dataset improvement job, not a user-facing research analysis run. Operate on the mounted canonical dataset volume, preferably using `DATASET_MOUNT_PATH`, and perform an actual create/delete write probe in the dataset root before downloads. If the dataset root is not writable, stop with a precise non-secret blocker.

Goal:
- Fill part of the documented housing and real-estate gap for Freddie Mac mortgage-rate coverage.
- Prefer official Freddie Mac PMMS / mortgage-rate archive sources.
- Land a compact provider-native public historical weekly PMMS file and accompanying source metadata.

Target source:
- Official Freddie Mac PMMS weekly mortgage-rate historical data page and/or direct official CSV download.
- Capture a consolidated historical CSV when available, preferably covering weekly 30-year fixed, 15-year fixed, 5/1 ARM, fees/points, and date fields back to the earliest public PMMS coverage.
- If the consolidated CSV endpoint has moved, use the current official Freddie Mac page to discover the direct public asset. If only a downloadable spreadsheet is available, preserve it provider-native and document that format.

Constraints:
- Store raw provider files only under a clear folder such as `raw/freddie_mac_pmms_<YYYYMMDD>/`.
- Do not create merged panels, derived variables, normalized tables, cross-source joins, regressions, or analysis-ready artifacts.
- Preserve provider filenames where practical.
- Capture source URLs, HTTP status, content type, content length when available, byte sizes, SHA-256 hashes, row/column counts, header names, date range, and rate/points fields.
- Do not use credentials, private endpoints, licensed products, or non-public data.

Required artifacts:
- `dataset_briefing.md` containing the full updated econ briefing, preserving prior documented sources and adding the new Freddie Mac PMMS entry.
- `improvement_result.json` with execution id, dataset id, source classification, files landed, byte/hash evidence, and limitations.
- `quality_report.md` describing write probe result, source verification, inventory checks, and any blockers.
- A raw/download inventory artifact such as `raw_inventory.csv`, `download_inventory.csv`, or equivalent.
- `report.html` summarizing what changed.

Profile/docs expectations:
- Update the dataset profile/quality metadata so `canonical:dataset -- status --dataset-id econ` can show this execution as disk-inventory proof.
- The final status should be suitable for local validation with `npm run canonical:dataset -- validate --dataset-id econ --execution-id <execution-id>`: required runtime artifacts present, `diskInventoryProven` true, and profile readback tied to this execution id.
- Do not replace the existing broad econ briefing with a narrow PMMS-only briefing. Preserve existing source bullets and limitations, and add/update only the relevant housing roadmap line.
