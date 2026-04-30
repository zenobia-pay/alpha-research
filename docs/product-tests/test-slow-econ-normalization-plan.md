# test:slow:econ:normalization-plan

## Product Use

An engineer validates the economics normalization planning workflow.

## Actions Taken

The product reads discovery outputs, plans the normalized table shape, and produces planning artifacts without executing ETL.

## Assertions Made

- `normalization_plan.json` is produced.
- Raw inventory status is represented.
- Target tables are defined.
- Raw-to-normalized mappings are defined.
- Primary keys and join keys are defined.
- QA checks are defined.
