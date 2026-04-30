# test:slow:econ:hypothesis

## Product Use

An engineer validates the economics hypothesis analysis workflow.

## Why This Test

This proves the economics environment can support an actual hypothesis workflow, not just dataset construction.

## Actions Taken

The product uses the canonical `econ` environment, checks whether required data exists, creates the analysis subset, runs transformation and labeling as needed, chooses visualization artifacts, tests the housing-cycle hypothesis, waits for completion, and shows results.

## Assertions Made

- The workflow reaches terminal success.
- Produced artifacts exist.
- Row-count, missingness, join, source URL, county, month, labeling, chart, and hypothesis evidence are present.
