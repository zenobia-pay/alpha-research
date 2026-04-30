# run debug bundle classifies worker-unreachable state as lifecycle-uncertain

## Product Use

An engineer investigates a remote run where the control plane lost confidence in the worker state. The run is not known to have succeeded, but it also does not have explicit product failure evidence.

The debug command should preserve this distinction so the engineer knows to reconcile worker logs, status files, and dataset-volume artifacts before retrying or declaring the product workflow failed.

## Why This Test

Remote workers can lose callback connectivity to the backend even when execution state on the droplet or dataset volume may still contain useful evidence. Treating that transport loss as a normal `failed` run hides the real lifecycle question.

This test protects the source-of-truth model: backend run status, durable worker state, and dataset artifacts need reconciliation before lifecycle-uncertain runs are classified as product failures.

## Actions Taken

The harness builds a run debug bundle for `run-unknown-1`. The fake backend returns status `worker_unreachable`, a callback-timeout event, and no artifacts.

The debug bundle is built without leaking the session token and includes a lifecycle interpretation derived from the remote run status.

## Assertions Made

- The lifecycle classification is `terminal_uncertain`.
- The lifecycle message tells the user that reconciliation is needed.
- The debug bundle still includes the remote evidence needed for follow-up investigation.
