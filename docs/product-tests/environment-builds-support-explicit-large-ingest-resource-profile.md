# environment builds support explicit large-ingest resource profile

## Product Use

Some backfills genuinely need a large workspace. The product should support an explicit large-ingest profile rather than making every environment large by default.

## Why This Test

Large storage must be deliberate. This protects both resource efficiency and the ability to run large jobs when justified.

## Actions Taken

The harness asks for a research environment with `resourceProfile` set to `large-ingest`.

## Assertions Made

The backend request carries the `large-ingest` profile with 500GiB scratch storage and versioned object-store publish semantics.
