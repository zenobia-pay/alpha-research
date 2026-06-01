# FFIEC/NIC Holding Company Financials Attempt

- Execution id: `07a25ab3-e91e-4b85-88d6-b02aa2a9c270`
- Target: `raw/ffiec_nic_holding_company_financials_2020_2026/`
- Intended source: official FFIEC/NIC Financial Data Download page at `https://www.ffiec.gov/npw/FinancialReport/FinancialDataDownload`
- Intended coverage: provider-native quarterly holding-company financial files for 2020 through the latest available 2026 quarter, including FR Y-9C/FR Y-9LP/FR Y-9SP content as exposed by the official combined quarterly files.
- Result: blocked. The remote worker discovered official endpoint candidates under `www.ffiec.gov/npw/FinancialReport`, including `GetFinancialDataFileToDownload`, `ReturnBHCFZipFiles`, and `GetYearList`, but automated requests returned HTTP 403 Cloudflare CAPTCHA HTML.
- Data landed: none. The run wrote a placeholder target-directory briefing and no provider files met the completion criteria.
- Follow-up: coordinate an automation-friendly FFIEC/NIC access path or retry from an environment/session that can lawfully pass the site challenge; do not add this source to the public inventory until provider files are actually preserved.
- Profile repair: the blocked run temporarily overwrote the backend profile with a placeholder-only briefing. The live profile was restored from the checked-in full econ briefing and prior disk-proven run `275c0c63-0203-4ebf-9353-71e1687043df`.
