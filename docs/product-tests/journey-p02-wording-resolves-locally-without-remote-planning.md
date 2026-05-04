# journey P02 wording resolves locally without remote planning

## Product Use

A user asks for the product behavior represented by journey P02.

## Why This Test

This keeps journey repair wording testable without requiring remote infrastructure. The answer should be product-facing and deterministic.

## Actions Taken

The agent handles the prompt locally while the fake remote client rejects any planning attempt.

## Assertions Made

The response matches the repaired P02 guidance and avoids starting a remote run, queueing work, or leaking internal tool names.
