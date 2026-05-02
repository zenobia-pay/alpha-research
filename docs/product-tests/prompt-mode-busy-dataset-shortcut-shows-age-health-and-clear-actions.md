# prompt-mode busy dataset shortcut shows age, health, and clear actions

## Product Use

In prompt mode, a busy dataset shortcut should summarize the blocking run's age, health, and available actions.

## Why This Test

Prompt mode has limited interaction. The single response must help users decide whether to wait, inspect, or cancel.

## Actions Taken

The harness returns an active blocking run with timestamps.

## Assertions Made

The response includes run age, current health, debug guidance, dashboard guidance, and avoids starting duplicate work.
