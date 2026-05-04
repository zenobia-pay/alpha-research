# dataset selection from topic uses dataset metadata and asks one focused follow-up

## Product Use

A user asks which dataset to use for a housing affordability topic.

## Why This Test

This protects recommendation quality. The product should use actual dataset metadata and ask only the next clarifying question needed to finalize scope.

## Actions Taken

The fake client returns candidate datasets and detail metadata for the likely match.

## Assertions Made

The response selects the best dataset, cites schema or coverage evidence, explains missing scope, and asks a single focused follow-up instead of launching analysis.
