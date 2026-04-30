# test:slow:econ:discover

## Product Use

An engineer validates the economics discovery workflow.

## Why This Test

This proves the economics workflow starts with source discovery and fetchability classification rather than pretending every catalog entry is immediately usable data.

## Actions Taken

The product creates or reuses the canonical `econ` environment, inspects the required source catalog, classifies source fetchability, records canonical URLs and direct download/API endpoints, and produces discovery artifacts.

Discovery output is expected to become durable handoff state for later economics stages, especially the source registry plan consumed by normalization planning and execution.

Sources that return login walls, HTTP 401/403 responses, challenge pages, paid terms, or manual agreement requirements are classified as `gated`, not `active`.

## Assertions Made

- `source_registry.plan.json` is produced.
- The source registry plan can serve as downstream stage input.
- Discovery evidence is present.
- Canonical URLs and direct download URLs are recorded.
- Fetchability is classified.
- Active, metadata-only, and gated source states are represented.
- Credential-challenge endpoints are not treated as public active sources.
- Artifacts are available.
