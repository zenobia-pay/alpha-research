# dataset selection from topic uses dataset metadata and asks one focused follow-up

## Product Use

A user asks which dataset to use for a topic. The product should inspect available dataset metadata, choose the strongest fit, explain why, and ask for the smallest useful clarification.

## Why This Test

Topic-to-dataset routing should be grounded in the user's real catalog. Guessing from generic public sources before checking existing datasets makes the product feel detached from its own data.

## Actions Taken

The harness provides candidate dataset metadata and asks for a dataset recommendation for a topic.

## Assertions Made

The answer uses actual dataset metadata, recommends the best match, explains the fit, and asks one focused follow-up rather than starting expensive work.
