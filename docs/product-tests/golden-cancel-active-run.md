# golden: cancel active run

## Product Use

A user asks to cancel `run-cancel-1`.

## Actions Taken

The product cancels the named run and confirms the cancellation in the response.

## Assertions Made

- The product calls `cancel_remote_run`.
- The response includes `Cancelled remote run run-cancel-1`.
