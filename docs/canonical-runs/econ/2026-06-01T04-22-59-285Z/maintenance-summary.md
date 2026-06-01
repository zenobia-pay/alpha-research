# Econ Dataset Expansion

- Dataset: `econ`
- Prompt path: `docs/canonical-runs/econ/2026-06-01T04-22-59-285Z/dataset-expansion-prompt.md`
- Execution id: `e0b58f37-a832-43fb-a2c0-972b38ede924`
- Admin status URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/e0b58f37-a832-43fb-a2c0-972b38ede924`
- Artifacts URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/e0b58f37-a832-43fb-a2c0-972b38ede924/artifacts`
- Result: validated

## Added Source

- Path: `raw/bls_qcew/BLS_CEW_2024_annual_by_area.zip`
- Source: Bureau of Labor Statistics Quarterly Census of Employment and Wages
- Format: provider-native ZIP of annual-by-area CSV tables
- Coverage: 2024 annual averages
- Geography: U.S. counties, states, metropolitan and combined statistical areas, and national totals
- Records: 4,451 CSV tables with 3,664,909 data rows excluding headers
- Fields: area FIPS, ownership and NAICS industry codes, establishments, employment, wages, contributions, average pay, location quotients, and over-the-year changes

## Validation

`npm run canonical:dataset -- validate --dataset-id econ --execution-id e0b58f37-a832-43fb-a2c0-972b38ede924` returned `status: validated`, with no missing required artifacts and profile run id matching the execution id.
