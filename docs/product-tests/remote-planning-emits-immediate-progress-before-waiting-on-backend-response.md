# remote planning emits immediate progress before waiting on backend response

## Product Use

When a remote planning request may take several seconds, the CLI should emit immediate progress so the user knows work has started.

## Why This Test

Silent waits feel like hangs. The product needs responsive terminal behavior even when the backend model or planner is still working.

## Actions Taken

The harness delays the remote planning response and observes emitted messages.

## Assertions Made

The CLI emits an immediate user-facing progress line before the delayed backend response completes.
