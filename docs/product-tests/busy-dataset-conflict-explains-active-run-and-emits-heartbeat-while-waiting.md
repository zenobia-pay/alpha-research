# busy dataset conflict explains active run and emits heartbeat while waiting

## Product Use

A user starts analysis on a dataset that is already locked by another run.

## Why This Test

This protects conflict handling. The product should show progress while checking and then explain why no duplicate run was started.

## Actions Taken

The fake remote API raises a 409 active-run error after heartbeat timing is enabled.

## Assertions Made

The response includes expected artifacts, heartbeat text, active run id/status, no-duplicate-run guidance, dashboard link, and debug command.
