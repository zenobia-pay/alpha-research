# signed-out cold-start orientation shows login hint

## Product Use

A new signed-out user asks an orientation question before choosing a dataset. The product should answer locally with a practical overview and show `/login` as an account-access option.

## Why This Test

Orientation should be fast, understandable, and safe. A cold-start product explanation should not depend on backend availability or account state.

## Actions Taken

The harness injects a remote client that would fail if called, then asks a broad orientation prompt.

## Assertions Made

The answer stays local, describes useful first actions, recommends concrete prompts, includes the signed-out `/login` hint, and avoids unnecessary remote tool calls.
