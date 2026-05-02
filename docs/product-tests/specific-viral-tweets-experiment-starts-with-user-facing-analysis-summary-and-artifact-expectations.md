# specific viral tweets experiment starts with user-facing analysis summary and artifact expectations

## Product Use

A user provides a specific viral-tweets experiment. The product should start the remote run and clearly summarize what analysis and artifacts were requested.

## Why This Test

For well-scoped research work, the CLI should move directly into execution while keeping the user informed about outputs and monitoring links.

## Actions Taken

The harness asks for a concrete viral-tweets experiment with dataset, metric, sample, labels, and outputs.

## Assertions Made

The product starts a remote run, includes artifact expectations, tracks the run, and returns user-facing status rather than raw tool internals.
