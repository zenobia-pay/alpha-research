# Econ Dataset Expansion

- Dataset: `econ`
- Prompt path: `docs/canonical-runs/econ/2026-06-01T04-45-17-509Z/dataset-expansion-prompt.md`
- Execution id: `12edf63f-e759-4f52-b9c8-0ba6625a4f2e`
- Admin status URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/12edf63f-e759-4f52-b9c8-0ba6625a4f2e`
- Artifacts URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/12edf63f-e759-4f52-b9c8-0ba6625a4f2e/artifacts`
- Result: validated

## Added Source

- Path: `raw/bis/WS_CBS_PUB_csv_col.zip`
- Source: Bank for International Settlements Consolidated Banking Statistics
- Format: provider-native ZIP with column-layout CSV
- Coverage: 1983-Q4 through 2025-Q4
- Geography: 157 jurisdictions across reporting bank nationality and counterparty country dimensions
- Records: 157,185 populated series rows and 6,832,169 numeric quarter values
- Fields: reporting bank nationality, counterparty sector/country, instrument, maturity bucket, reporting basis, balance-sheet position, and quarterly observation columns

## Validation

`npm run canonical:dataset -- validate --dataset-id econ --execution-id 12edf63f-e759-4f52-b9c8-0ba6625a4f2e` returned `status: validated`, with no missing required artifacts and profile run id matching the execution id.
