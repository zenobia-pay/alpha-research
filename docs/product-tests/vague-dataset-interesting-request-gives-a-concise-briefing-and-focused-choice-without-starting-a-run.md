# vague dataset interesting request gives a concise briefing and focused choice without starting a run

## Product Use

A user asks to analyze a dataset and say what is interesting without choosing scope.

## Why This Test

This protects the approval gate for broad analysis. The product should inspect metadata and ask for a focused choice before spending remote time.

## Actions Taken

The fake client returns dataset profile metadata and fails if a run is started.

## Assertions Made

The response gives a concise dataset briefing, names focused next-step options, and says no broad remote analysis will start until scope is chosen.
