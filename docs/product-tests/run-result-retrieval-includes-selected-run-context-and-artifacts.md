# run result retrieval includes selected run context and artifacts

## Product Use

A user asks to see the result of a previous run.

## Why This Test

This protects the result-reading experience. Users should understand what a completed run did and what artifacts were produced without manually reconstructing context.

## Actions Taken

The product retrieves the run result bundle and turns it into a readable report. It includes the original request, summarizes structured result fields, explains saved artifacts, and suggests grounded next steps.

## Assertions Made

- The original run prompt is shown.
- Structured row-count evidence is summarized.
- Artifacts are described as saved run outputs.
- Suggested follow-ups are included.
- The user is not shown an undigested raw JSON dump.
