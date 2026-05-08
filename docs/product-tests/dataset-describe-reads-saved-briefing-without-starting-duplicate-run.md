# dataset describe reads saved briefing without starting duplicate run

## Product Use

A user asks to describe a dataset while other remote work may exist. The product should read the saved dataset briefing instead of starting another run.

## Why This Test

Dataset documentation is owned by the dataset record. The CLI should reuse that saved markdown directly and avoid duplicate remote work.

## Actions Taken

The fake backend returns a dataset detail record with `dataset_briefing.md` markdown and Dataset Profile metadata. The test fails if the CLI tries to start a run.

## Assertions Made

The response reads the saved briefing, includes the briefing source, mentions the Dataset Profile metadata when present, and does not show active-run conflict or expected-artifact guidance.
