# county-month housing-cycle dataset requests reuse a strong economics base and start the build immediately

## Product Use

This product test exercises the CLI behavior for `county-month housing-cycle dataset requests reuse a strong economics base and start the build immediately` from the user's point of view.

## Why This Test

The scenario protects a user-facing contract in the research CLI. It keeps the product response understandable, avoids accidental remote work, and makes sure the user sees the right state, artifact, or recovery guidance for this workflow.

## Actions Taken

The deterministic harness simulates the relevant CLI request and backend state. It then runs the local product logic or tool flow that should handle the request without relying on live services.

## Assertions Made

- The CLI chooses the intended product behavior for this scenario.
- User-facing text includes the important state, action, artifact, or recovery detail.
- The flow avoids unrelated remote calls, duplicate work, raw internals, or missing handoff information.
