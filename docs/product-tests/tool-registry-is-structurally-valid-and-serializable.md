# tool registry is structurally valid and serializable

## Product Use

The product exposes a tool registry that the assistant can use to take actions.

## Why This Test

This protects the assistant action surface. Tool metadata must remain stable and serializable so product behavior can be tested and prompted reliably.

## Actions Taken

The registry metadata is loaded and checked for stable, serializable definitions.

## Assertions Made

- Every tool has a name.
- Every tool has a description.
- Every tool has a JSON schema.
- Registry metadata can be serialized.
