# dataset-owned canonical briefing describes available data without processed-table wording

## Product Use

This product test exercises the CLI behavior for `dataset-owned canonical briefing describes available data without processed-table wording` from the user's point of view.

## Why This Test

Canonical datasets should know and explain what they contain through their own `dataset_briefing.md`. The CLI should present that briefing directly and avoid implementation wording like "processed tables" when the user asks what data is available.

## Actions Taken

The deterministic harness provides an `econ` dataset with dataset-owned briefing content and asks the CLI to describe it.

## Assertions Made

- The response uses the dataset-owned briefing content.
- The response names available data and sources in user-facing language.
- The response does not mention `processed tables`.
