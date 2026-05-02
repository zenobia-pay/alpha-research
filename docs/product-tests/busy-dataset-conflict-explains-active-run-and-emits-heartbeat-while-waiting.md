# busy dataset conflict explains active run and emits heartbeat while waiting

## Product Use

A user starts work on a dataset that is locked by an active run. The product should show progress while attempting the action, then explain the active run conflict clearly.

## Why This Test

Without good conflict handling, users can create duplicate work or think the CLI failed mysteriously. Busy states need an actionable run id and recovery path.

## Actions Taken

The fake backend delays the environment request and then returns a dataset-volume conflict with an active run.

## Assertions Made

The CLI emits heartbeat progress, reports expected artifacts, identifies the blocking run, avoids starting duplicate work, and gives debug/dashboard guidance.
