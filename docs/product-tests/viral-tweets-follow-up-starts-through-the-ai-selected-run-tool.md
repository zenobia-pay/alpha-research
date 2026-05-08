# viral tweets follow-up starts through the AI-selected run tool

## Product Use

A user asks for a viral-tweets experiment, then follows up with a metric and sample size.

## Why This Test

This protects the contract that experiment planning and run prompting are model-selected tool work, not a local hardcoded viral-tweets compiler.

## Actions Taken

The deterministic harness has the model first return a scoped plan, then choose `run_remote_transformation` on the follow-up.

## Assertions Made

- The first turn does not start a run.
- The follow-up starts through the model-selected run tool.
- The run id and dashboard handoff are shown.
- The old hardcoded viral-tweets derivation text does not appear.
