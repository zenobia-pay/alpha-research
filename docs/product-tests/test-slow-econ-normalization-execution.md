# test:slow:econ:normalization-execution

## Product Use

An engineer validates the economics acquisition, normalization execution, and QA workflow.

## Why This Test

This proves planned economics sources can become normalized tables with QA evidence, and that placeholder metadata cannot count as data success.

## Actions Taken

The product fetches active/fetchable raw data, writes raw inventory, executes normalization, and produces normalized data plus QA artifacts.

## Assertions Made

- `manifest.json` is produced.
- `source_registry.csv` is produced.
- `table_catalog.json` is produced.
- `qa_report` evidence is present.
- Row counts, missingness, joins, source URLs, county fields, and month fields are validated.
- Placeholder metadata cannot count as data success for fetchable sources.
