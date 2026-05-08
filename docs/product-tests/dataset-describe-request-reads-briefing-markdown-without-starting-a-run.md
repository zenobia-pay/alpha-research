# dataset describe request reads briefing markdown without starting a run

## Product Use

A user asks the product to describe the `econ` dataset.

## Why This Test

This protects the dataset-description workflow as a read-only briefing lookup. A describe request may be routed by the model to the briefing tool, but the selected tool should present the dataset-owned `dataset_briefing.md` markdown when it exists and should not launch remote documentation work.

## Actions Taken

The model selects the read-only dataset briefing tool. The product resolves `econ`, reads the remote dataset detail record, and returns the saved briefing markdown from `dataset_briefing.md`.

## Assertions Made

- The AI path selects the read-only dataset briefing tool.
- No remote run is started.
- The response includes the saved briefing markdown.
- The response names `dataset_briefing.md` as the briefing source.
- The response does not include run-start language, expected run artifacts, or terminal-session details.
