# canonical public environments use small versioned object-store resource profile

## Product Use

Creating a canonical public dataset should use a small versioned object-store resource profile instead of a large block-volume workspace.

## Why This Test

Canonical public datasets need daily refreshes and many fields. Preallocating 500GiB per dataset causes quota failures and prevents scaling.

## Actions Taken

The harness starts a canonical `sociology` public environment and captures the resource contract sent to the backend.

## Assertions Made

The request uses the `canonical-public` profile, a 50GiB scratch workspace, object-store versioning, read-only dataset-version access, and versioned publish mode.
