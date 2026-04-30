# wait for run completion can time out deterministically

## Product Use

A user asks the product to wait for a run to complete.

## Why This Test

This protects long-running work UX. If a run is not done, the product should say so clearly rather than inventing completion or hiding uncertainty.

## Actions Taken

The product polls the run and streams available status. If the wait budget expires while the run is still active, it reports that the run is still running instead of pretending it finished.

## Assertions Made

- The product checks run status.
- The timeout path is deterministic.
- A still-running run is reported as still running.
- The product does not fabricate terminal results.
