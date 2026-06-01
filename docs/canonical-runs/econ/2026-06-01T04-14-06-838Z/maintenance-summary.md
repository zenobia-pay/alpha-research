# Econ Dataset Expansion

- Dataset: `econ`
- Prompt path: `docs/canonical-runs/econ/2026-06-01T04-14-06-838Z/dataset-expansion-prompt.md`
- Execution id: `c77a56d8-5e5b-44fb-ac42-46c6f3a7d613`
- Admin status URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/c77a56d8-5e5b-44fb-ac42-46c6f3a7d613`
- Artifacts URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/c77a56d8-5e5b-44fb-ac42-46c6f3a7d613/artifacts`
- Result: validated

## Added Source

- Path: `raw/worldbank_findex/GlobalFindexDatabase2025.xlsx`
- Source: World Bank Global Findex Database 2025
- Format: provider-native Excel workbook
- Coverage: 2011, 2014, 2017, 2021, and 2024 survey waves
- Geography: 169 economies plus aggregate regions
- Records: 8,565 indicator rows in `Data`; 457 metadata rows in `Series Table`
- Fields: 1,038 columns covering household financial inclusion indicators and demographic breakdowns

## Validation

`npm run canonical:dataset -- validate --dataset-id econ --execution-id c77a56d8-5e5b-44fb-ac42-46c6f3a7d613` returned `status: validated`, with no missing required artifacts and profile run id matching the execution id.
