# stuck run question escalates stale running run to debug now

## Product Use

A user asks whether an older running run is stuck.

## Why This Test

This protects escalation. When a run has not updated for several minutes, the product should recommend immediate inspection instead of vague waiting.

## Actions Taken

The test injects a running tracked run with a five-minute-old update and last event message.

## Assertions Made

The response says the run may be stalled, cites the last event, reports the age, and tells the user to run the debug command now.
