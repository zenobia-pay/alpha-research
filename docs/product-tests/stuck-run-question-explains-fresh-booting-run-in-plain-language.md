# stuck run question explains fresh booting run in plain language

## Product Use

A user asks whether a very fresh booting run is stuck.

## Why This Test

This protects false alarms. The product should explain that a newly booting run may still be mounting data and should not be treated as failed immediately.

## Actions Taken

The test injects a tracked run updated thirty seconds ago.

## Assertions Made

The answer says it does not look stuck yet, describes the waiting state in plain language, suggests waiting briefly, and includes the debug command.
