# dataset inspection surfaces schema evidence for requested analysis fields

## Product Use

A user asks whether a dataset can support a specific analysis. The product should inspect schema/profile evidence and surface the relevant fields.

## Why This Test

Trustworthy dataset selection depends on concrete evidence. The assistant should not merely assert that a dataset is suitable.

## Actions Taken

The harness provides a profile containing fields related to county, time, unemployment, and home values.

## Assertions Made

The response names the inspected dataset, reports relevant schema evidence, and summarizes coverage useful for the requested analysis.
