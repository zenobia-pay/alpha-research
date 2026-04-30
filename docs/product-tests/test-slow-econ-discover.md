# test:slow:econ:discover

## Product Use

An engineer validates the economics discovery workflow.

## Actions Taken

The product creates or reuses the canonical `econ` environment, inspects the required source catalog, classifies source fetchability, records canonical URLs and direct download/API endpoints, and produces discovery artifacts.

## Assertions Made

- `source_registry.plan.json` is produced.
- Discovery evidence is present.
- Canonical URLs and direct download URLs are recorded.
- Fetchability is classified.
- Active, metadata-only, and gated source states are represented.
- Artifacts are available.
