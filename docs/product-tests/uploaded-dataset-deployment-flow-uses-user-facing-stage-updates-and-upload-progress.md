# uploaded dataset deployment flow uses user-facing stage updates and upload progress

## Product Use

A user creates and deploys a dataset from a local CSV.

## Why This Test

This protects the full upload lifecycle. The CLI should show each user-facing stage and progress without exposing raw tool names.

## Actions Taken

The fake client walks through file resolution, profiling, registration, upload target creation, upload, verification, and deployment.

## Assertions Made

The transcript includes local file use, profile check, dataset creation, upload target, 100 percent progress, upload verification, deployment start, and terminal-session link.
