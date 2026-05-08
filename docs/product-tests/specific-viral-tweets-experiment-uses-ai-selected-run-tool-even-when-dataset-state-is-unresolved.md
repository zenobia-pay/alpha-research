# specific viral tweets experiment uses AI-selected run tool even when dataset state is unresolved

## Product Use

A user provides a fully specified viral-tweets experiment.

## Why This Test

This protects the contract that the CLI does not locally parse and compile a special viral-tweets experiment prompt. The model chooses the run tool and supplies the prompt.

## Actions Taken

The deterministic harness has the model choose `run_remote_transformation` for `enriched-tweets`. The fake backend accepts the run.

## Assertions Made

- The run starts through the model-selected tool.
- No local viral-tweets compiler runs.
- The run id and dashboard handoff are shown.
