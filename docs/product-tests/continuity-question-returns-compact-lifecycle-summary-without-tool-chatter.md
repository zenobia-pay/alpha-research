# continuity question returns compact lifecycle summary without tool chatter

## Product Use

A user asks what is going on or where things stand. The product should summarize active and recent runs in plain language.

## Why This Test

Continuity questions happen in long-running async workflows. The answer should be compact and useful, not a dump of tool calls.

## Actions Taken

The harness provides tracked run state and asks a continuity-style question.

## Assertions Made

The response gives lifecycle status, highlights actionable runs, and avoids raw tool chatter or excessive internals.
