# FHFA HPI Master CSV Maintenance Summary

- Dataset: `econ`
- Execution: `91a949cc-5830-4e9e-a93e-f3c1845e7ef6`
- Admin status: `https://alpharesearch.nyc/api/admin/remote-agent-executions/91a949cc-5830-4e9e-a93e-f3c1845e7ef6`
- Artifacts: `https://alpharesearch.nyc/api/admin/remote-agent-executions/91a949cc-5830-4e9e-a93e-f3c1845e7ef6/artifacts`

The remote worker downloaded and inventoried the official FHFA House Price Index master CSV under `raw/fhfa_hpi_master_20260601/`, but it left the collected `dataset_briefing.md` artifact as the startup placeholder. Local validation therefore remains blocked for this execution artifact set even after profile repair:

```bash
npm run canonical:dataset -- validate --dataset-id econ --execution-id 91a949cc-5830-4e9e-a93e-f3c1845e7ef6
```

The blocker is the run-collected placeholder briefing artifact, not the backend profile readback. After repairing the profile from the full checked-in briefing, `npm run canonical:dataset -- status --dataset-id econ` reports `queryReady: true`, `diskInventoryProven: true`, and `volumeInventoryRunId: 91a949cc-5830-4e9e-a93e-f3c1845e7ef6`.

Evidence recovered from the remote transcript:

- FHFA landing page `https://www.fhfa.gov/house-price-index?tab=HPI+Datasets` returned HTTP 200 HTML and contained the direct `hpi_master.csv` href.
- Direct CSV `https://www.fhfa.gov/hpi/download/monthly/hpi_master.csv` returned HTTP 200, `Content-Type: text/csv; charset=UTF-8`, and `Content-Length: 17044016`.
- Stored file: `raw/fhfa_hpi_master_20260601/hpi_master.csv`.
- Size and hash: 17,044,016 bytes; SHA-256 `a21426a1798ec61d79804d9115c69f4060e51297b46d6ad6cc1dd24841f4c12e`.
- Shape and coverage: 184,807 rows x 12 columns; fields `hpi_type`, `hpi_flavor`, `frequency`, `level`, `place_name`, `place_id`, `yr`, `period`, `index_nsa`, `index_sa`, `rstderr`, and `note`; 1975-01 through 2026-03; monthly and quarterly series.
- Geography: 9,310 USA-or-census-division rows, 144,540 MSA rows, 30,712 state rows, and 245 Puerto Rico rows, covering 410 MSAs and 51 state/DC geographies.

The checked-in briefing and MDX docs mirror were updated manually from this evidence while preserving the accumulated full econ inventory. The roadmap now treats FHFA HPI as present in part and keeps the remaining housing and real-estate gaps explicit.
