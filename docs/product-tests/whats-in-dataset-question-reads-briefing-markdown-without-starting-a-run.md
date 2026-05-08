# whats-in dataset question reads briefing markdown without starting a run

## Product Use

A user asks what is in the `econ` dataset using natural language instead of a literal describe command.

## Why This Test

This protects the intended AI-driven routing: the model may choose the read-only dataset briefing tool, but the CLI should not use a local phrase matcher and should not launch a remote briefing refresh.

## Actions Taken

The model selects `describe_remote_dataset` for `econ`. The tool resolves the dataset, reads the saved dataset-owned briefing markdown, and returns it to the model for a concise user-facing answer.

## Assertions Made

- The AI path selects the read-only dataset briefing tool.
- The dataset detail endpoint is read for `econ`.
- No remote run is started.
- The response includes the briefing contents and source.
- The response does not include run-start language or a run id.
