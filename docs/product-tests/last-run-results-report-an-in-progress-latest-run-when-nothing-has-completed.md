# last run results report an in-progress latest run when nothing has completed

## Product Use

A user asks for last results when all recent work is still running. The product should report in-progress status instead of pretending results exist.

## Why This Test

Async workflows must handle waiting states honestly. Fabricated or premature results would undermine trust.

## Actions Taken

The harness returns only in-progress run history.

## Assertions Made

The response says no completed result is available yet, identifies the active run, and gives a concrete inspection path.
