# golden: retrieve run result

## Product Use

A user asks to show `run-results-1`.

## Actions Taken

The product retrieves the run result and turns it into a readable summary with original request, row counts, and artifact context.

## Assertions Made

- The product calls `get_run_results`.
- The original request is shown.
- The response includes `Rows: 100`.
- Artifacts are explained as saved outputs.
