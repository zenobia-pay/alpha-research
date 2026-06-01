# Econ Canonical Run Maintenance Summary

- Dataset: `econ`
- Execution id: `f43e909b-da04-4d07-9e8b-5de5a2da35cd`
- Admin status URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/f43e909b-da04-4d07-9e8b-5de5a2da35cd`
- Outcome: data landed; canonical validator blocked on the immutable narrow `dataset_briefing.md` artifact until profile/docs were repaired from the checked-in full briefing.
- Raw directory: `raw/bls_bed_births_deaths_20260601`
- Provider source: official BLS BED time-series files from `https://downloadt.bls.gov/pub/time.series/bd/`
- Files: `bd.data.1.AllItems` (249,676,992 bytes; SHA-256 `ac038aec2d61aaaf7639d47077ec1f3eb6baafaacc6eeb25cc8f653b7c1598d2`; 4,529,617 rows; 1992Q3-2025Q2) and `bd.series` (5,611,568 bytes; 34,464 series definitions).
- Dataset profile repair: backend profile was synced from the checked-in full econ briefing with `volumeInventoryRunId` and `describedRunId` set to this execution id.
- Current inventory implication: the first BLS BED public time-series gap is now filled; deeper state/industry BED detail and restricted BED/LBD microdata remain roadmap gaps.
