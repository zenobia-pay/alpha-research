# Econ Canonical Run Maintenance Summary

- Dataset: `econ`
- Execution id: `f6bb4260-d014-416d-9b4b-d3b0196f41b5`
- Admin status URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/f6bb4260-d014-416d-9b4b-d3b0196f41b5`
- Outcome: data landed; remote run was interrupted before final artifacts/docs, leaving startup-placeholder `dataset_briefing.md` and `improvement_result.json` artifacts.
- Raw directory: `raw/ons_cpih_20260601`
- Provider source: official ONS Consumer Price Inflation current detailed reference tables file endpoint for `consumerpriceinflation`.
- File: `consumerpriceinflationdetailedreferencetables.xlsx` (2,115,142 bytes; SHA-256 `7fdcda8dde24419200ad6aab3f4be7a9a5493fd364ddc2bcdf7d92dea0e29d57`; HTTP 200; ETag `10b10743738242f9d530fcafae1c9c2e96f36e42--gzip`).
- Inventory evidence: workbook is a valid XLSX with 41 worksheets; run event logs reported 7,752 inspected rows, up to 182 columns, monthly UK CPIH/CPI coverage from January 1988 through April 2026, and Open Government Licence v3.0 terms.
- Dataset profile repair: backend profile was synced from the checked-in full econ briefing with `volumeInventoryRunId` and `describedRunId` set to this execution id.
- Current inventory implication: the first ONS CPIH/CPI detailed reference-table gap is filled; broader ONS monthly GDP, labour, trade, productivity, balance-of-payments/IIP, regional, Blue Book revision, and API/catalog coverage remain roadmap gaps.
