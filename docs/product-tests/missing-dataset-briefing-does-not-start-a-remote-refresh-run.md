# missing dataset briefing does not start a remote refresh run

## Product Use

A user asks what is on the `econ` dataset, but the remote dataset detail record does not currently include saved `dataset_briefing.md` markdown.

## Why This Test

This protects the read-only contract for dataset inventory questions. A missing briefing is not permission to kick off remote work; the CLI should report that the saved briefing is unavailable instead of silently starting a background refresh.

## Actions Taken

The model selects `describe_remote_dataset` for `econ`. The tool resolves the dataset, reads the remote dataset detail record, detects that no saved briefing markdown is present, and returns a clear no-briefing status to the model.

## Assertions Made

- The AI path selects the read-only dataset briefing tool.
- The dataset detail endpoint is read for `econ`.
- No remote run is started when the saved briefing is missing.
- The transcript says no dataset briefing markdown is available.
- The transcript says no remote describe run was started.
- The response does not include run-start language or a generated run id.
