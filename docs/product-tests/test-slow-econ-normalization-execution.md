# test:slow:econ:normalization-execution

## Product Use

An engineer validates the economics acquisition, normalization execution, and QA workflow.

## Why This Test

This proves planned economics sources can become normalized tables with QA evidence, and that placeholder metadata cannot count as data success.

## Actions Taken

The product fetches active/fetchable raw data, writes raw inventory, executes normalization, and produces normalized data plus QA artifacts.

Before fetching, the execution stage verifies that a durable source registry is available from the mounted dataset. If `source_registry.plan.json` is missing, it may reconstruct it from persisted registry files such as `source_registry.csv` or manifest entries, but it must fail loudly if no durable registry exists.

The execution stage also revalidates active endpoints. If an endpoint returns a credential challenge such as HTTP 401/403, it updates the registry to `gated` with a reason and excludes that source from active-source success criteria.

Because this is a live product E2E, execution completes a bounded real acquisition batch across representative public sources rather than attempting every catalog source in one test run. Public sources outside the batch can be marked `deferred_fetchable` with notes, while fetched sources must normalize to non-empty tables.

## Assertions Made

- `manifest.json` is produced.
- `source_registry.csv` is produced.
- Missing source-registry inputs are reconstructed from durable registry evidence or reported as hard failures.
- Credential-challenge endpoints are reclassified as `gated` before active-source success is evaluated.
- Representative public sources are fetched and normalized with non-empty row counts.
- Public sources outside the bounded E2E batch are marked `deferred_fetchable` with notes.
- `table_catalog.json` is produced.
- `qa_report` evidence is present.
- Row counts, missingness, joins, source URLs, county fields, and month fields are validated.
- Placeholder metadata cannot count as data success for fetchable sources.
