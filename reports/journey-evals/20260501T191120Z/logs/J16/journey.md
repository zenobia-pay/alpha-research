# J16: Busy Dataset Conflict

## Prompt

```text
Run a new analysis on enriched-tweets.
```

## Setup

The dataset already has an active blocking run.

## Intention

The user wants work done but does not know the dataset is locked.

## Correct Outcome

`research` reports the conflict, identifies the blocking run, shows status/link, and suggests waiting, inspecting, or cancelling if appropriate. It should not start duplicate competing work.

## Judge For

Was the conflict obvious, did it identify the blocking run, did it explain why no new run started, and was the next action clear?
