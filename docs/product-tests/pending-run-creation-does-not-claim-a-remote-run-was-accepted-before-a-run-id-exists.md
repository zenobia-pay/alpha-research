# pending run creation does not claim a remote run was accepted before a run id exists

## Product Use

A user approves an experiment and asks RESEARCH to run it on a remote dataset, but the backend start-run request fails before returning a run id.

## Why This Test

This protects the launch handoff language. The CLI must not imply that a run was accepted or created until the backend has returned a concrete run id that can appear on the runs page.

## Actions Taken

The model selects `start_research_run` for `econ`. The prompt generator produces the remote experiment prompt, then the start-run API call remains pending long enough for heartbeat text to render and finally fails without returning a run id.

## Assertions Made

- The pending heartbeat says no run id has been returned yet.
- The final blocked message says the CLI cannot confirm any remote run was created.
- The transcript does not say the request was accepted by the backend.
- The transcript does not say the backend worker is initializing.
- The transcript does not include normal run-start success language.
