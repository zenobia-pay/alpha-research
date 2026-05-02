# cold-start orientation prompt stays local and recommends first steps

## Product Use

A new user asks an orientation question before choosing a dataset or signing in. The product should answer locally with a practical overview instead of calling remote planning.

## Why This Test

Orientation should be fast, understandable, and safe. A cold-start product explanation should not depend on backend availability or account state.

## Actions Taken

The harness injects a remote client that would fail if called, then asks a broad orientation prompt.

## Assertions Made

The answer stays local, describes useful first actions, recommends concrete prompts, and avoids unnecessary remote tool calls.
