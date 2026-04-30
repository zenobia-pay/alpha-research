# test:slow:econ

## Product Use

An engineer validates the full economics product journey.

## Why This Test

This protects the staged economics journey as a suite, ensuring the individual stages work together from discovery through hypothesis analysis.

## Actions Taken

The product runs discovery, normalization planning, normalization execution, environment orchestration, and hypothesis analysis in order.

## Assertions Made

- Every economics stage reaches its expected success criteria.
- The journey moves from source discovery to usable hypothesis artifacts.
- A failure in any stage fails the economics suite.
