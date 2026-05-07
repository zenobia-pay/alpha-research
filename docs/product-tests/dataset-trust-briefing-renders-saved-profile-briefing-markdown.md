# dataset trust briefing renders saved profile briefing markdown

## Product Use

A user asks the CLI to describe or evaluate a remote dataset. The backend has already saved a human dataset briefing in the dataset profile as `briefingMarkdown`.

## Why This Test

Dataset briefings are the product-facing explanation of what a dataset contains. The CLI must use the saved briefing body when it is available instead of falling back to a synthetic profile summary or starting another remote describe run.

## Actions Taken

The deterministic harness provides a ready `econ` dataset whose profile includes `briefingMarkdown`, a briefing artifact id, and a profile artifact id. The user asks to describe the dataset, and the CLI handles the request locally from saved dataset metadata.

## Assertions Made

- The rendered response includes the saved briefing markdown body.
- The response names the saved Dataset Briefing and Dataset Profile artifacts.
- The flow does not start a duplicate dataset briefing run.
- The flow does not replace the saved markdown with the generic profile fallback.
