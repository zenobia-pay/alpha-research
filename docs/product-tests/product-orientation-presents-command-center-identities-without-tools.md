# product orientation presents command center identities without tools

## Product Use

A user asks `What can you help me do?` before choosing a dataset, file, research question, or run.

## Why This Test

This protects the top-level product framing. `research` should present itself as a local command center for data work and research work, not as a narrow dataset CLI or a remote-infrastructure wrapper. The answer should orient the user around the four jobs they actually care about: intake, navigation, design, and operation.

## Actions Taken

The agent answers the orientation question locally. The fake remote client throws if it is called, so the test proves orientation does not require backend planning, tool calls, dashboard state, or run ids.

## Assertions Made

- The answer says `research` is a local command center.
- The answer mentions messy data, vague research intent, durable research work, datasets, remote runs, analysis artifacts, and follow-up decisions.
- The answer covers intake, dataset navigation, study design before spending remote time, durable runs/artifacts, and recovery of prior work.
- The answer avoids implementation-heavy language such as mounted datasets, lifecycle statuses, or manifest internals.
