# agent prompt frames RESEARCH as run-oriented command center

## Product Use

A user sends an open-ended research question or asks RESEARCH to plan work. The model-facing instruction block should frame the product as a command center for durable research work, with runs as the main operating unit.

## Why This Test

This protects the core product prompt from drifting back toward local file management, implementation-heavy dataset internals, or scattered behavioral micro-rules. The agent should orient around research environments, hypotheses, grounded run planning, and human-readable results.

## Actions Taken

The test captures the instructions sent to the model during a representative dataset field question. It does not depend on the model's final answer; it verifies the exact product framing that the CLI provides before the model reasons over the user's request.

## Assertions Made

- The instructions identify RESEARCH as a command center for research.
- The instructions say RESEARCH turns vague research intent into durable, grounded research work.
- The instructions frame the main operation as planning and executing runs.
- The instructions say research runs should be driven by concrete, falsifiable hypotheses.
- The instructions require choosing the right research environment and returning run id plus dashboard link when a run starts.
