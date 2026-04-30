# non-resumable run continuation returns artifacts instead of crashing

## Product Use

A user asks the CLI to continue work from a previous remote run. The prior run completed and produced durable artifacts, but the backend result bundle does not include a `remote_agent_session` artifact that can be resumed.

The product should not turn that backend shape into a local CLI crash. It should keep the conversation alive, tell the assistant that the run is not resumable, and expose the saved artifacts so the assistant can summarize them or ask the user to start a fresh follow-up run.

## Why This Test

Live product E2E runs can finish successfully with normal summary and transcript artifacts while still lacking a resumable terminal session. Before this coverage, `continue_remote_agent_run` threw an exception in that state, which made a successful remote run look like a failed CLI command.

This test protects the CLI trust boundary: missing resumability is product state, not process failure. The assistant receives a structured `not_resumable` tool result and can recover without losing the evidence from the run.

## Actions Taken

The harness simulates an authenticated CLI turn where the remote planner asks to call `continue_remote_agent_run` for `run-no-session`.

The fake backend returns a ready run with a normal `Remote Agent Summary` artifact and no `remote_agent_session` artifact. The CLI executes the tool, returns a non-crashing tool result, and sends that result back to the planner.

## Assertions Made

- The tool result reports `reason: not_resumable`.
- The produced `Remote Agent Summary` artifact is included in the tool result.
- The CLI does not call `startRun` for a continuation that lacks a resumable session.
- The final assistant message includes that the run does not have a resumable remote agent session.
