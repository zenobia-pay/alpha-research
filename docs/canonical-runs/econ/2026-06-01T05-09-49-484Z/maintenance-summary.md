# Econ Dataset Expansion

- Dataset: `econ`
- Prompt path: `docs/canonical-runs/econ/2026-06-01T05-09-49-484Z/dataset-expansion-prompt.md`
- Execution id: `05f10dfd-77cd-479b-af7f-56919c9240b8`
- Admin status URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/05f10dfd-77cd-479b-af7f-56919c9240b8`
- Artifacts URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/05f10dfd-77cd-479b-af7f-56919c9240b8/artifacts`
- Result: validated

## Added Source

- Path: `raw/bls_atus/`
- Source: Bureau of Labor Statistics American Time Use Survey
- Format: seven provider-native ZIP archives
- Coverage: American Time Use Survey activity codes, respondent microdata, CPS linkage, household summary, and published time-use tables
- Geography: United States
- Records: person-level diary microdata with weights and 17,000+ cases annually, plus summary estimates by activity and demographics
- Fields: activity categories, respondent/time diary records, household summaries, CPS linkage fields, weights, and published estimate dimensions

## Validation

`npm run canonical:dataset -- validate --dataset-id econ --execution-id 05f10dfd-77cd-479b-af7f-56919c9240b8` returned `status: validated`, with no missing required artifacts and profile run id matching the execution id. Profile readback remained a full accumulated inventory and included the new `raw/bls_atus/` source.
