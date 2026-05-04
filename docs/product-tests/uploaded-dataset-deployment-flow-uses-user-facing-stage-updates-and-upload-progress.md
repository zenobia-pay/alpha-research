# uploaded dataset deployment flow uses user-facing stage updates and upload progress

## Product Use

A user uploads a local file and deploys it as a dataset. The product should show each lifecycle stage in human language.

## Why This Test

File upload and deployment can take time. Users need progress, verification, and a run id without being exposed to internal tool names.

## Actions Taken

The harness creates a temporary CSV, resolves it, profiles it, registers the dataset, uploads it through a presigned URL, verifies completion, and starts deployment.

## Assertions Made

The transcript includes file resolution, inspection, dataset creation, upload target readiness, upload progress, upload verification, deployment start, and the canonical terminal-session link.
