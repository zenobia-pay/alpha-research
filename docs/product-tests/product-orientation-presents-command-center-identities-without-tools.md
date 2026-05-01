# product orientation presents command center identities without tools

## Product Use

A user asks `What can you help me do?` before choosing a dataset, file, research question, or run.

## Why This Test

This protects the top-level product framing. `research` should explain itself in plain language, with a clear first step and a short list of useful next actions. It should orient the user around the jobs they care about without making them learn product jargon first.

## Actions Taken

The agent answers the orientation question locally. The fake remote client throws if it is called, so the test proves orientation does not require backend planning, tool calls, dashboard state, or run ids.

## Assertions Made

- The answer explains `research` in simple user language.
- The answer includes one clear `Start here` command and 3-5 concrete next actions.
- The answer covers dataset creation, dataset inspection/briefing, analysis, and reviewing earlier results.
- The answer avoids implementation-heavy language such as mounted datasets, lifecycle statuses, manifest internals, remote runs, or artifacts.
