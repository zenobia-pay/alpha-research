# test:slow:econ:environment

## Product Use

An engineer validates the end-to-end economics environment build.

## Why This Test

This proves the full economics environment build can orchestrate discovery, acquisition, normalization, and QA into usable dataset artifacts.

## Actions Taken

The product runs discovery, acquisition, normalization planning, normalization execution, and QA as one orchestrated environment build.

## Assertions Made

- Discovery evidence is present.
- Normalization planning evidence is present.
- Normalization execution evidence is present.
- Raw inventory, normalized outputs, manifest, source registry, table catalog, DuckDB catalog, row counts, missingness, joins, source URLs, and artifacts are represented.
