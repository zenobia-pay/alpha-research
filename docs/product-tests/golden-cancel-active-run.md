# golden: cancel active run

## Product Use

A user asks to cancel `run-cancel-1`.

## Why This Test

This verifies a direct control action remains simple and explicit. When a user asks to cancel a run, the product should perform that action and confirm it clearly.

## Actions Taken

The product cancels the named run and confirms the cancellation in the response.

## Assertions Made

- The product calls `cancel_remote_run`.
- The response includes `Cancelled remote run run-cancel-1`.
