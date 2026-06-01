# Econ Dataset Expansion Summary

- Dataset: `econ`
- Execution: `dc7f30e8-4e90-4852-aed2-da86d6213678`
- Admin status: `https://alpharesearch.nyc/api/admin/remote-agent-executions/dc7f30e8-4e90-4852-aed2-da86d6213678`
- Artifacts: `https://alpharesearch.nyc/api/admin/remote-agent-executions/dc7f30e8-4e90-4852-aed2-da86d6213678/artifacts`
- Validation: `validated`
- Profile readback: `disk_proven`, run id `dc7f30e8-4e90-4852-aed2-da86d6213678`

## Added Data

World Bank Global Financial Development Database:

- Path: `raw/worldbank_gfdd/GFDD_EXCEL.zip`
- Source: World Bank
- Coverage: annual 1960-2023
- Geography: 196 World Bank economies
- Records: 24,300 country-indicator rows across 75 indicators
- Fields: country code, indicator code, annual values, and series metadata
- Caveat: workbook retains provider structure; some indicators require metadata review for coverage and forecast/status interpretation.

## Validation Evidence

`npm run canonical:dataset -- validate --dataset-id econ --execution-id dc7f30e8-4e90-4852-aed2-da86d6213678` returned `status: validated`, with no missing required artifacts and profile run id matching the execution id.
