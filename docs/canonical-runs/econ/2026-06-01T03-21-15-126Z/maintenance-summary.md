# Econ Dataset Expansion Summary

- Dataset: `econ`
- Execution: `e1aa9db8-7465-4f93-b0a1-ccef279fe0f1`
- Admin status: `https://alpharesearch.nyc/api/admin/remote-agent-executions/e1aa9db8-7465-4f93-b0a1-ccef279fe0f1`
- Artifacts: `https://alpharesearch.nyc/api/admin/remote-agent-executions/e1aa9db8-7465-4f93-b0a1-ccef279fe0f1/artifacts`
- Validation: `validated`
- Profile readback: `disk_proven`, run id `e1aa9db8-7465-4f93-b0a1-ccef279fe0f1`

## Added Data

Federal Reserve Financial Accounts of the United States (Z.1):

- Path: `raw/federal_reserve_z1/z1_csv_files_20260319.zip`
- Source: Federal Reserve Board
- Coverage: quarterly 1951Q4-2023Q4 and annual 1945-2023
- Geography: United States
- Records: 84,065 observations across 292 CSV tables, plus 294 dictionary files
- Fields: flow/level series codes, sector and instrument descriptors, quarterly and annual period columns
- Caveat: values are in billions of dollars for levels and flows; refresh after quarterly Federal Reserve releases.

## Validation Evidence

`npm run canonical:dataset -- validate --dataset-id econ --execution-id e1aa9db8-7465-4f93-b0a1-ccef279fe0f1` returned `status: validated`, with no missing required artifacts and profile run id matching the execution id.
