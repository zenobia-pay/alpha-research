# last run results report an in-progress latest run when nothing has completed

## Product Use

A user asks for last results when only in-progress runs exist.

## Why This Test

This prevents fake result summaries. If no run has completed, the product should say so and point to status/debug actions.

## Actions Taken

Tracked runs contain active records but no completed record.

## Assertions Made

The response says no completed results are available, identifies the active run, and gives a concrete follow-up or debug path.
