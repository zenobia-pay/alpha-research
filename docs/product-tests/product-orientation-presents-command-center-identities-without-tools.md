# product orientation presents command center identities without tools

## Product Use

A user asks `What can you help me do?` before choosing a dataset, file, research question, or run.

## Why This Test

This protects the top-level product framing. `research` should describe itself as a command center for agentic research and show concrete natural-language prompts the user can try.

## Actions Taken

The agent answers the orientation question locally. The fake remote client throws if it is called, so the test proves orientation does not require backend planning, tool calls, dashboard state, or run ids.

## Assertions Made

- The answer says RESEARCH is a command center for agentic research.
- The answer includes concrete prompt examples for idea generation, hypotheses, canonical economics data, personal data, and latest results.
- The answer hides `/login` when the user is already signed in.
- The answer avoids implementation-heavy language such as mounted datasets, lifecycle statuses, manifest internals, remote runs, or artifacts.
