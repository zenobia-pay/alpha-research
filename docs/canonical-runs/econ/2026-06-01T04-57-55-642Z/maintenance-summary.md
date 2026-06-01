# Econ Dataset Expansion

- Dataset: `econ`
- Prompt path: `docs/canonical-runs/econ/2026-06-01T04-57-55-642Z/dataset-expansion-prompt.md`
- Execution id: `f66702b0-63c4-4b62-9878-6d5c86a911f7`
- Admin status URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/f66702b0-63c4-4b62-9878-6d5c86a911f7`
- Artifacts URL: `https://alpharesearch.nyc/api/admin/remote-agent-executions/f66702b0-63c4-4b62-9878-6d5c86a911f7/artifacts`
- Result: validated, followed by profile briefing repair

## Added Source

- Path: `raw/oecd_sna/SNA_TABLE1_20260601.csv`
- Source: OECD National Accounts Table 1 expenditure aggregates
- Format: provider SDMX CSV
- Coverage: annual observations, 1950-2025
- Geography: 71 OECD and partner economies
- Records: 772,072 annual observations
- Fields: expenditure-side national accounts transactions, including `P3`, `P6`, `P7`, and `P51G`, with values in national currency and PPP dollars

## Validation

`npm run canonical:dataset -- validate --dataset-id econ --execution-id f66702b0-63c4-4b62-9878-6d5c86a911f7` returned `status: validated`, with no missing required artifacts and profile run id matching the execution id.

The first profile readback after validation contained only this run's new OECD SNA bullet. The checked-in public briefing was therefore used as the source for a backend profile repair so the CLI-visible `briefingMarkdown` once again lists the full accumulated inventory plus the new OECD source.
