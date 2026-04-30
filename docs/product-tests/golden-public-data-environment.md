# golden: public data environment

## Product Use

A user asks to create a public data environment from SEC filings for payment-company risk factors.

## Why This Test

This verifies that public-source setup starts a durable environment build with a run to track, instead of presenting unfinished acquisition as completed research.

## Actions Taken

The product checks existing datasets, starts a public-data environment build, and gives the user the run id plus dashboard link.

## Assertions Made

- Existing datasets are listed first.
- A public-data environment build is started.
- The response includes `run-public-env-1`.
- The response includes the canonical dashboard link.
- The build is represented as in progress, not as completed analysis.
