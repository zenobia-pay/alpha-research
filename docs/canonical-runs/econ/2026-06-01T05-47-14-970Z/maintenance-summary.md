# Econ Dataset Expansion

- Dataset: `econ`
- Prompt path: `docs/canonical-runs/econ/2026-06-01T05-47-14-970Z/dataset-expansion-prompt.md`
- Execution id: `d52ae11b-f065-4ba1-887f-2eef6498b30b`
- Admin status URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/d52ae11b-f065-4ba1-887f-2eef6498b30b`
- Artifacts URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/d52ae11b-f065-4ba1-887f-2eef6498b30b/artifacts`
- Result: validated, followed by profile briefing cleanup

## Added Source

- Path: `raw/census_cbp/cbp22co.zip`
- Source: Census County Business Patterns 2022 county file
- Format: provider-native ZIP
- Coverage: calendar year 2022 annual totals
- Geography: 3,192 counties and county equivalents
- Records: 1,100,804 county-industry rows
- Fields: NAICS industries, establishments, employment, first-quarter payroll, annual payroll, establishment-size class counts, and Census disclosure flags

## Validation

`npm run canonical:dataset -- validate --dataset-id econ --execution-id d52ae11b-f065-4ba1-887f-2eef6498b30b` returned `status: validated`, with no missing required artifacts and profile run id matching the execution id.

The first profile readback contained the new CBP 2022 source but retained a duplicate malformed placeholder line for the same file. The checked-in briefing was used to repair the backend profile so the accumulated inventory remains clean.
