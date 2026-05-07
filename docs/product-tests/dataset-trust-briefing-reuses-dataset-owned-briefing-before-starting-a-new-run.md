# dataset trust briefing reuses dataset-owned briefing before starting a new run

## Product Use

This product test exercises the CLI behavior for `dataset trust briefing reuses dataset-owned briefing before starting a new run` from the user's point of view.

## Why This Test

The scenario protects the contract that dataset inventory comes from the dataset-owned `dataset_briefing.md` file. The CLI should reuse that briefing when it exists, avoid accidental remote work, and avoid synthesizing comprehensive inventory from loose profile fragments.

## Actions Taken

The deterministic harness simulates the relevant CLI request and backend state. It then runs the local product logic or tool flow that should handle the request without relying on live services.

## Assertions Made

- The CLI chooses the intended product behavior for this scenario.
- User-facing text includes the important state, action, artifact, or recovery detail.
- The flow avoids unrelated remote calls, duplicate work, raw internals, or missing handoff information.
