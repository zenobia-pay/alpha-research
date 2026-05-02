# last run results select the latest completed run and explain newer active runs

## Product Use

A user asks for the last run's results while newer runs may still be active. The product should avoid blending active and completed work.

## Why This Test

Users often return after starting work asynchronously. The CLI needs to distinguish a completed result from a newer in-progress run.

## Actions Taken

The harness provides run history with completed and active runs.

## Assertions Made

The response selects the latest completed run for results and explains that newer active runs still exist separately.
