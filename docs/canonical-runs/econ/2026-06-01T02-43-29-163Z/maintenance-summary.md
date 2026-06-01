# Econ Dataset Expansion Summary

- Dataset: `econ`
- Execution: `7ecdb48f-e807-421a-ae18-e53ac94d7271`
- Admin status: `https://alpharesearch.nyc/api/admin/remote-agent-executions/7ecdb48f-e807-421a-ae18-e53ac94d7271`
- Artifacts: `https://alpharesearch.nyc/api/admin/remote-agent-executions/7ecdb48f-e807-421a-ae18-e53ac94d7271/artifacts`
- Validation: `validated`
- Profile readback: `disk_proven`, run id `7ecdb48f-e807-421a-ae18-e53ac94d7271`

## Added Data

World Bank World Development Indicators bulk CSV archive:

- Path: `raw/worldbank/WDI_CSV_2026_04_09.zip`
- Source: World Bank
- Coverage: annual 1960-2025
- Geography: 266 economies plus aggregate regions
- Records: about 395,276 indicator-year observations in the provider CSV archive
- Caveat: requires standard World Bank Data attribution; future vintages are released periodically.

## Validation Evidence

`npm run canonical:dataset -- validate --dataset-id econ --execution-id 7ecdb48f-e807-421a-ae18-e53ac94d7271` returned `status: validated`, with no missing required artifacts and profile run id matching the execution id.
