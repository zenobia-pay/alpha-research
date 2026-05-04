# stuck run question escalates stale running run to debug now

## Product Use

A user asks about a stale running run. The product should escalate to debugging when the run has not updated recently.

## Why This Test

Long-running work can fail silently. The CLI should distinguish normal boot time from stale execution that needs diagnostics.

## Actions Taken

The harness provides a running run with an old update timestamp.

## Assertions Made

The response says the run may be stalled, reports the last update age, and recommends `research debug run` for the specific run.
