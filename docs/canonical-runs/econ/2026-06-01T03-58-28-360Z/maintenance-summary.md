# Econ Dataset Expansion Summary

- Dataset: `econ`
- Execution: `f2010010-d26f-45ba-a3f3-9485141bc4a7`
- Admin status: `https://alpharesearch.nyc/api/admin/remote-agent-executions/f2010010-d26f-45ba-a3f3-9485141bc4a7`
- Artifacts: `https://alpharesearch.nyc/api/admin/remote-agent-executions/f2010010-d26f-45ba-a3f3-9485141bc4a7/artifacts`
- Validation: `validated`
- Profile readback: `disk_proven`, run id `f2010010-d26f-45ba-a3f3-9485141bc4a7`

## Added Data

OECD Composite Leading Indicators:

- Path: `raw/oecd_mei/MEI_CLI_USA_20260601.csv`
- Source: OECD
- Coverage: monthly 1947-02-2026-05 and quarterly 1947-Q1-2026-Q1
- Geography: 57 OECD and partner economies
- Records: 238,145 observations across monthly and quarterly series
- Fields: dataflow, reference area, frequency, measure, unit, adjustment, transformation, time horizon, methodology, period, value, status, multiplier, decimals, and base period
- Caveat: OECD terms restrict commercial redistribution; refresh monthly through the SDMX endpoint.

## Validation Evidence

`npm run canonical:dataset -- validate --dataset-id econ --execution-id f2010010-d26f-45ba-a3f3-9485141bc4a7` returned `status: validated`, with no missing required artifacts and profile run id matching the execution id.
