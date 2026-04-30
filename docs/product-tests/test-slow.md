# test:slow

## Product Use

An engineer validates the full slow product suite.

## Why This Test

This protects the full slow product suite as a release confidence signal for both economics and tweets workflows.

## Actions Taken

The product runs all staged economics slow tests and the viral tweets slow test.

## Assertions Made

- The economics product journey passes through its current stages.
- The tweets product journey completes and returns artifacts.
- Failures in either journey fail the suite.
