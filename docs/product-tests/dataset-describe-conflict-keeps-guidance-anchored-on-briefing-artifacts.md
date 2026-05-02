# dataset describe conflict keeps guidance anchored on briefing artifacts

## Product Use

A dataset describe request can conflict with an active run. The product should keep the guidance anchored on the requested briefing artifacts rather than drifting into generic analysis advice.

## Why This Test

Dataset documentation is a distinct workflow. Busy guidance should preserve the user's intent and tell them what artifacts to expect.

## Actions Taken

The fake backend returns an active-run conflict for a dataset briefing run.

## Assertions Made

The response names the blocking run, avoids a duplicate run, mentions expected Dataset Briefing and Dataset Profile artifacts, and gives inspection guidance.
