# remote planning emits immediate progress before waiting on backend response

## Product Use

A signed-in user asks for work that needs remote planning.

## Why This Test

This protects perceived responsiveness. The CLI should show useful progress immediately while waiting for the backend rather than appearing frozen.

## Actions Taken

The fake remote client delays its response while emitted messages are captured.

## Assertions Made

The transcript includes immediate planning or lookup progress before the backend result, then returns the final assistant response.
