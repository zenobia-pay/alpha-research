# dataset inventory is recommendation-first, name-first, and de-emphasizes noisy datasets

## Product Use

A user asks what datasets are available.

## Why This Test

This protects inventory as a decision surface rather than a raw dump. Ready and meaningful datasets should be easy to find, while test or draft datasets should not dominate.

## Actions Taken

The test supplies local and remote dataset summaries with mixed readiness and noisy names.

## Assertions Made

The response names the best starting point first, groups ready datasets separately, includes ids and readiness, and pushes smoke or draft datasets into the secondary group.
