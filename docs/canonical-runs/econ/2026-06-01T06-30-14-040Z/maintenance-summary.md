# Econ Dataset Expansion

- Dataset: `econ`
- Prompt path: `docs/canonical-runs/econ/2026-06-01T06-30-14-040Z/dataset-expansion-prompt.md`
- Execution id: `e5e6f371-80d1-4bf9-885d-61eea58b6bf9`
- Admin status URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/e5e6f371-80d1-4bf9-885d-61eea58b6bf9`
- Artifacts URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/e5e6f371-80d1-4bf9-885d-61eea58b6bf9/artifacts`
- Result: validated

## Added Source

- Path: `raw/bis_lbs/WS_LBS_D_PUB_csv_col.zip`
- Source: Bank for International Settlements Locational Banking Statistics
- Format: provider column-layout bulk ZIP
- Coverage: quarterly observations from 1977-Q4 through 2025-Q4
- Geography: reporting jurisdictions and counterparty-country groupings
- Records: 608,570 reporting-country/position rows with 193 quarterly observation columns
- Fields: reporter, counterparty grouping, counterparty sector, currency denomination, instrument category, positions outstanding, and growth metrics

## Validation

`npm run canonical:dataset -- validate --dataset-id econ --execution-id e5e6f371-80d1-4bf9-885d-61eea58b6bf9` returned `status: validated`, with no missing required artifacts and profile run id matching the execution id.
