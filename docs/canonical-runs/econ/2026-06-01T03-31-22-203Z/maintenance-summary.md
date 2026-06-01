# Econ Dataset Expansion Summary

- Dataset: `econ`
- Execution: `ffb252f6-ef93-4388-ab9d-b18bcf9431e6`
- Admin status: `https://alpharesearch.nyc/api/admin/remote-agent-executions/ffb252f6-ef93-4388-ab9d-b18bcf9431e6`
- Artifacts: `https://alpharesearch.nyc/api/admin/remote-agent-executions/ffb252f6-ef93-4388-ab9d-b18bcf9431e6/artifacts`
- Validation: `validated`
- Profile readback: `disk_proven`, run id `ffb252f6-ef93-4388-ab9d-b18bcf9431e6`

## Added Data

World Bank International Debt Statistics long-format archive:

- Path: `raw/worldbank_ids/IDS_CSV_long_2026.zip`
- Source: World Bank
- Coverage: annual 1970-2032
- Geography: 134 economies worldwide
- Records: 8,236 populated country-year rows across 576 indicators
- Fields: country, counterpart area, year, external debt stock, flow, service, and ratio indicators
- Caveat: annual updates; use World Bank attribution when publishing.

## Validation Evidence

`npm run canonical:dataset -- validate --dataset-id econ --execution-id ffb252f6-ef93-4388-ab9d-b18bcf9431e6` returned `status: validated`, with no missing required artifacts and profile run id matching the execution id.
