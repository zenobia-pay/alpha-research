# Econ Dataset Expansion

- Dataset: `econ`
- Prompt path: `docs/canonical-runs/econ/2026-06-01T06-18-05-688Z/dataset-expansion-prompt.md`
- Execution id: `61cee25b-7280-40a0-9199-338b4cfde874`
- Admin status URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/61cee25b-7280-40a0-9199-338b4cfde874`
- Artifacts URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/61cee25b-7280-40a0-9199-338b4cfde874/artifacts`
- Result: validated

## Added Sources

- Path: `raw/census_asm/AM2231GS1.zip`
- Source: Census Annual Survey of Manufactures 2022 General Statistics
- Format: provider ZIP with pipe-delimited `.dat`, field layout, and README
- Coverage: reference year 2022
- Geography: NAICS-by-state and national manufacturing rows
- Records: 2,592 data rows

- Path: `raw/census_asm/ASMBENCHMARK2022.zip`
- Source: Census ASM 2022 Benchmark Supplement
- Format: provider ZIP with `.dat`, field layout, and README
- Coverage: reference year 2022
- Geography: national manufacturing industries
- Records: 2,592 data rows

## Validation

`npm run canonical:dataset -- validate --dataset-id econ --execution-id 61cee25b-7280-40a0-9199-338b4cfde874` returned `status: validated`, with no missing required artifacts and profile run id matching the execution id.
