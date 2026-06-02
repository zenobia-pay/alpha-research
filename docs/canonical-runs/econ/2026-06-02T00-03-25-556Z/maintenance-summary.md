# Econ Canonical Maintenance Summary

- Dataset: `econ`
- Execution: `98cb77ed-5fba-4c35-9f7d-37d003628d45`
- Admin status: https://alpharesearch.nyc/api/admin/remote-agent-executions/98cb77ed-5fba-4c35-9f7d-37d003628d45
- Prompt record: `docs/canonical-runs/econ/2026-06-02T00-03-25-556Z/improve-prompt.md`
- Validation: passed with `status: validated`.

This run added the official ONS Balance of Payments Statistical Bulletin Tables 2025 Q4 workbook under `raw/ons_bop_iip_20260602/`. The provider-native file is `balanceofpayments2025q4.xlsx` (678,539 bytes; SHA-256 `5783622a2bbb35e751493689ad9bcd6230f1f2a8321993bda303cc04bca47852`; HTTP 200), plus local metadata, inventory, and sheet-summary evidence.

Coverage: quarterly current-account balances, trade detail, international-investment-position components, and revisions tables spanning 1997 Q1 through 2025 Q4. Units are GBP millions. The run verified the live profile as `disk_proven`, `writeReady: true`, with `volumeInventoryRunId` set to `98cb77ed-5fba-4c35-9f7d-37d003628d45`.
