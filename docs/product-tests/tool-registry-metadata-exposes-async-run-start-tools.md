# tool registry metadata exposes async run-start tools

## Product Use

The product needs to know which tools start asynchronous work so the assistant can return run-tracking information instead of pretending results are immediate.

## Actions Taken

The registry metadata is inspected for async run-start flags.

## Assertions Made

- Async run-starting tools are exposed as such.
- Non-run tools are not incorrectly treated as run starters.
