# Econ Dataset Expansion

- Dataset: `econ`
- Prompt path: `docs/canonical-runs/econ/2026-06-01T06-02-12-815Z/dataset-expansion-prompt.md`
- Execution id: `efeda689-f305-425d-a3c5-1e03bc6b0433`
- Admin status URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/efeda689-f305-425d-a3c5-1e03bc6b0433`
- Artifacts URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/efeda689-f305-425d-a3c5-1e03bc6b0433/artifacts`
- Result: validated

## Added Source

- Path: `raw/eurostat/PRC_HICP_AIND.tsv`
- Source: Eurostat Harmonised Index of Consumer Prices annual index dataset
- Format: provider SDMX TSV
- Coverage: annual observations from 1996 through 2025
- Geography: 45 EU, EEA, and partner geographies
- Records: 35,287 geo-COICOP rows across 30 year columns
- Fields: geo, COICOP aggregate, HICP unit codes, annual values, and provider missing-value markers

## Validation

`npm run canonical:dataset -- validate --dataset-id econ --execution-id efeda689-f305-425d-a3c5-1e03bc6b0433` returned `status: validated`, with no missing required artifacts and profile run id matching the execution id.
