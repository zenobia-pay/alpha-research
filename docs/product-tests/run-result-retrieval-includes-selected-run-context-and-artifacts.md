# run result retrieval includes selected run context and artifacts

## Product Use

A user asks for results from a specific run. The product should present the selected run, original request, key results, artifacts, and dashboard link.

## Why This Test

Run ids are only useful if the CLI turns them back into understandable research outputs. Artifact context is part of the product result.

## Actions Taken

The harness returns a completed run with events, artifacts, and result content.

## Assertions Made

The response includes the selected run context, summarizes results, lists artifacts as saved outputs, and links the canonical dashboard route.
