# specific viral tweets experiment starts with user-facing analysis summary and artifact expectations

## Product Use

A user asks for a concrete viral tweets experiment.

## Why This Test

This protects remote run starts by making the scope and expected outputs visible before background work continues.

## Actions Taken

The fake remote client starts a run and returns artifact metadata.

## Assertions Made

The transcript shows the selected dataset, analysis intent, expected artifacts, run id, and dashboard or follow-up affordance without exposing raw tool plumbing.
