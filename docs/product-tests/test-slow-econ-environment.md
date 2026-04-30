# test:slow:econ:environment

## Product Use

An engineer validates the end-to-end economics environment build.

## Why This Test

This proves the full economics environment build can orchestrate discovery, acquisition, normalization, and QA into usable dataset artifacts.

## Actions Taken

The product runs discovery, acquisition, normalization planning, normalization execution, and QA as one orchestrated environment build.

The environment build exercises the same source-registry handoff guarantees as the staged suite: discovery output must remain durable enough for acquisition, normalization, QA, and downstream analysis.

Credentialed or challenge-protected sources are represented as gated registry entries so the orchestrator can continue with truly public/fetchable data.

The live environment test may use bounded representative acquisition for public sources, but it still requires durable normalized outputs and QA artifacts.

## Assertions Made

- Discovery evidence is present.
- Source-registry handoff artifacts remain available across orchestrated stages.
- Gated source classification is respected during acquisition and QA.
- Representative public-source acquisition produces normalized data and QA artifacts.
- Normalization planning evidence is present.
- Normalization execution evidence is present.
- Raw inventory, normalized outputs, manifest, source registry, table catalog, DuckDB catalog, row counts, missingness, joins, source URLs, and artifacts are represented.
