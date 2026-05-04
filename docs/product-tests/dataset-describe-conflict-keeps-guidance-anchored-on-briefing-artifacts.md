# dataset describe conflict keeps guidance anchored on briefing artifacts

## Product Use

A user asks for a dataset briefing while a briefing or analysis run is active.

## Why This Test

This protects documentation workflow conflict handling. The answer should remain about Dataset Briefing and Dataset Profile artifacts rather than drifting into general analysis guidance.

## Actions Taken

The fake client raises an active-run conflict for the describe request.

## Assertions Made

The response names the dataset, active run, expected briefing artifacts, result retrieval command, and debug command.
