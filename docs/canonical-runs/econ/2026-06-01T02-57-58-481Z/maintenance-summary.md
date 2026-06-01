# Econ Dataset Expansion Summary

- Dataset: `econ`
- Execution: `34034196-98d9-44b1-9964-709af773851d`
- Admin status: `https://alpharesearch.nyc/api/admin/remote-agent-executions/34034196-98d9-44b1-9964-709af773851d`
- Artifacts: `https://alpharesearch.nyc/api/admin/remote-agent-executions/34034196-98d9-44b1-9964-709af773851d/artifacts`
- Validation: `validated`
- Profile readback: `disk_proven`, run id `34034196-98d9-44b1-9964-709af773851d`

## Added Data

Penn World Table version 10.0 global macroeconomic accounts:

- Path: `raw/pwt/pwt100.xlsx`
- Source: Penn World Table (GGDC)
- Coverage: annual 1950-2019
- Geography: 183 economies and aggregate regions
- Records: 12,810 country-year rows
- Fields: real GDP, population, employment, capital, hours, total factor productivity, and demand aggregates
- Caveat: PPP-based country-level measures; future releases are expected periodically.

## Validation Evidence

`npm run canonical:dataset -- validate --dataset-id econ --execution-id 34034196-98d9-44b1-9964-709af773851d` returned `status: validated`, with no missing required artifacts and profile run id matching the execution id.
