# test:slow:econ:discover

## Product Use

An engineer validates the economics discovery workflow.

## Why This Test

This proves the economics workflow starts with source discovery and fetchability classification rather than pretending every catalog entry is immediately usable data.

## Actions Taken

The product creates or reuses the canonical `econ` environment, inspects the required source catalog, classifies source fetchability, records canonical URLs and direct download/API endpoints, and produces discovery artifacts.

## Assertions Made

- `source_registry.plan.json` is produced.
- Discovery evidence is present.
- Canonical URLs and direct download URLs are recorded.
- Fetchability is classified.
- Active, metadata-only, and gated source states are represented.
- Artifacts are available.
