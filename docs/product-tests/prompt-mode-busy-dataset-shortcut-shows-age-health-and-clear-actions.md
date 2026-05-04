# prompt-mode busy dataset shortcut shows age, health, and clear actions

## Product Use

A prompt-mode user asks to run analysis on a locally tracked busy dataset.

## Why This Test

This protects the fast path that avoids unnecessary remote planning. The product should detect the local blocker and provide useful age and health context.

## Actions Taken

The test writes a temporary tracked-run record and asks for new work on the same dataset.

## Assertions Made

The response reports the active run id, status, start and update times, lock explanation, dashboard link, and inspect/wait/cancel options.
