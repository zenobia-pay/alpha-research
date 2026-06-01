# Econ Dataset Expansion

- Dataset: `econ`
- Prompt path: `docs/canonical-runs/econ/2026-06-01T05-20-23-714Z/dataset-expansion-prompt.md`
- Execution id: `6f790294-5ba2-4c6d-a4be-ccc0af496404`
- Admin status URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/6f790294-5ba2-4c6d-a4be-ccc0af496404`
- Artifacts URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/6f790294-5ba2-4c6d-a4be-ccc0af496404/artifacts`
- Result: validated, followed by profile briefing cleanup

## Added Source

- Path: `raw/census_cbp/cbp23co.zip`
- Source: Census County Business Patterns 2023 county file
- Format: provider-native ZIP
- Coverage: calendar year 2023 annual totals
- Geography: 3,143 counties and county equivalents
- Records: 1,100,962 county-industry rows
- Fields: NAICS industries, employment, annual payroll, first-quarter payroll, establishments, establishment-size buckets, and disclosure flags

## Validation

`npm run canonical:dataset -- validate --dataset-id econ --execution-id 6f790294-5ba2-4c6d-a4be-ccc0af496404` returned `status: validated`, with no missing required artifacts and profile run id matching the execution id.

The first profile readback contained the new CBP 2023 source but also included a malformed placeholder line for the older CBP 2022 file. The checked-in briefing was used to repair the backend profile so the accumulated inventory remains clean.
