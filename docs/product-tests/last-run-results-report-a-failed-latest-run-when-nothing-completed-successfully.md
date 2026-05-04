# last run results report a failed latest run when nothing completed successfully

## Product Use

A user asks for results when the latest known run failed.

## Why This Test

This protects failure handling. The product should not present failed work as results and should guide debugging.

## Actions Taken

Tracked runs contain a failed run and no successful completed run.

## Assertions Made

The response reports the failure state, identifies the run, and gives a debug or recovery action without inventing artifacts.
