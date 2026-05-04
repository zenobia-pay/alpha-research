# dataset describe request falls back to saved briefing when dataset is busy

## Product Use

A user asks to describe a dataset while another run is holding the dataset. If a saved briefing exists, the product should return that useful documentation instead of only reporting a conflict.

## Why This Test

Dataset understanding should remain useful during active work. Saved profile artifacts are durable product value and should be reused.

## Actions Taken

The harness makes the describe run hit an active-run conflict and provides a saved dataset briefing/profile.

## Assertions Made

The response explains the busy state, uses the saved briefing, names the briefing/profile artifacts, and provides the blocking run for follow-up.
