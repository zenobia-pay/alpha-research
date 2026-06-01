# Econ Canonical Run Maintenance Summary

- Dataset: `econ`
- Execution id: `88516807-cdb3-4d11-99ac-4bf2fad40242`
- Admin status URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/88516807-cdb3-4d11-99ac-4bf2fad40242`
- Outcome: blocked, no FFIEC Call Report data landed.
- Target source: FFIEC Central Data Repository public bulk data page at `https://cdr.ffiec.gov/public/PWS/DownloadBulkData.aspx`.
- Evidence: initial `curl` access returned the public `Download Bulk Data - FFIEC Central Data Repository's Public Data Distribution` HTML, including the reporting-series choices; subsequent Python `requests` access returned Azure Application Gateway `403 Forbidden`, and the ASP.NET postback workflow was not completed.
- Dataset profile repair: backend profile was restored from the checked-in full econ briefing with `volumeInventoryRunId` and `describedRunId` set back to the last real data run, `f43e909b-da04-4d07-9e8b-5de5a2da35cd`.
- Current inventory implication: historical FFIEC Call Report bulk archives remain an explicit credit, banking, and financial-markets roadmap gap.
