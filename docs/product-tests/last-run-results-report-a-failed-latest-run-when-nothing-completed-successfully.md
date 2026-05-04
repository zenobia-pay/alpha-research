# last run results report a failed latest run when nothing completed successfully

## Product Use

A user asks for last results after the latest relevant work failed. The product should surface the failure and diagnostics rather than searching for unrelated success.

## Why This Test

Failure states are part of the research lifecycle. The user needs to understand what failed and how to inspect it.

## Actions Taken

The harness returns failed run history without a successful completed run.

## Assertions Made

The response reports the failed run, avoids claiming results, and gives debug or dashboard next steps.
