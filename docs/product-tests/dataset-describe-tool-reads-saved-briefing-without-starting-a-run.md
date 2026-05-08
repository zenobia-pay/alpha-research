# dataset describe tool reads saved briefing without starting a run

## Product Use

A model tool call asks to describe a dataset. If a saved briefing exists, the tool should return that markdown directly instead of starting a remote run.

## Why This Test

Dataset understanding should come from the durable dataset-owned briefing. The describe tool is now a read-only lookup, not a remote documentation job.

## Actions Taken

The harness returns a saved dataset briefing/profile and fails if `startRun` is called.

## Assertions Made

The response uses the saved briefing, names the briefing/profile artifacts, and does not mention a started briefing run or blocking run.
