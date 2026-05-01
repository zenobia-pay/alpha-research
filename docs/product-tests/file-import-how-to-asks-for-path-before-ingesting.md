# file import how-to asks for path before ingesting

## Product Use

A user says they have a CSV on their desktop and asks how to turn it into something they can research.

## Why This Test

Dataset intake should be helpful without pretending the product can ingest data that has not been identified. The lifecycle starts with a concrete file path and a short description, then proceeds through schema inference, registration, upload, and deployment. Skipping that source-of-truth step creates confusing or fake intake flows.

## Actions Taken

The agent receives a raw-file onboarding question with no exact path. The fake remote client throws if called, so the test verifies that the agent does not start remote planning or dataset deployment prematurely.

## Assertions Made

- The answer asks for an absolute path.
- The answer asks for a one-line data description.
- The answer explains that the next lifecycle steps are schema inference, dataset registration, upload, and deployment.
- No run id, started-run message, or dashboard link appears.
- No remote planning call is made before the user provides the file source of truth.
