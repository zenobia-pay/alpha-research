# test:slow:econ:normalization-plan

## Product Use

An engineer validates the economics normalization planning workflow.

## Why This Test

This proves the product can turn discovered sources into a concrete normalization plan before executing ETL.

## Actions Taken

The product reads discovery outputs, plans the normalized table shape, and produces planning artifacts without executing ETL.

If the mounted dataset does not already expose `source_registry.plan.json`, the planning stage reconstructs or recreates it from durable discovery evidence and writes it back beside the normalization plan so later stages can run from the dataset volume alone.

The plan keeps credential-challenge sources gated so execution only treats genuinely public/fetchable sources as active.

## Assertions Made

- `normalization_plan.json` is produced.
- `source_registry.plan.json` is preserved or recreated for downstream acquisition.
- Gated source classifications are carried into the normalization plan.
- Raw inventory status is represented.
- Target tables are defined.
- Raw-to-normalized mappings are defined.
- Primary keys and join keys are defined.
- QA checks are defined.
