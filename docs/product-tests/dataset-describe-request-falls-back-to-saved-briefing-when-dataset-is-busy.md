# dataset describe request falls back to saved briefing when dataset is busy

## Product Use

A user asks for a dataset description while the dataset is blocked.

## Why This Test

This protects read-only documentation access when live briefing cannot start. The product should recover useful saved profile evidence instead of failing hard.

## Actions Taken

The fake client reports a busy dataset and provides stored dataset profile data.

## Assertions Made

The response uses the saved briefing/profile, explains that live work is blocked, and keeps the answer anchored to dataset documentation.
