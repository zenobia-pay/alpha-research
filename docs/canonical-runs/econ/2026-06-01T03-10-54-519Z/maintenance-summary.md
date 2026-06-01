# Econ Dataset Expansion Summary

- Dataset: `econ`
- Execution: `b4d612e1-1913-4ccb-8e52-a1b10ae7cc70`
- Admin status: `https://alpharesearch.nyc/api/admin/remote-agent-executions/b4d612e1-1913-4ccb-8e52-a1b10ae7cc70`
- Artifacts: `https://alpharesearch.nyc/api/admin/remote-agent-executions/b4d612e1-1913-4ccb-8e52-a1b10ae7cc70/artifacts`
- Validation: `validated`
- Profile readback: `disk_proven`, run id `b4d612e1-1913-4ccb-8e52-a1b10ae7cc70`

## Added Data

Census County Business Patterns 2022 county ZIP:

- Path: `raw/census_cbp/cbp22co.zip`
- Source: U.S. Census Bureau
- Coverage: 2022 annual
- Geography: United States counties and county equivalents
- Records: 1,100,804 county-industry rows
- Fields: FIPSCODE, county, NAICS, establishments, paid employees, annual payroll, first-quarter payroll, employment size classes, and suppression flags
- Caveat: suppressed cells use Census disclosure flags; annual updates are released each spring.

## Validation Evidence

`npm run canonical:dataset -- validate --dataset-id econ --execution-id b4d612e1-1913-4ccb-8e52-a1b10ae7cc70` returned `status: validated`, with no missing required artifacts and profile run id matching the execution id.
