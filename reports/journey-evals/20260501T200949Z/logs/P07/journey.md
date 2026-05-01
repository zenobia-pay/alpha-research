# P07: Specific Research Request To Run

## Prompt

```text
Using enriched-tweets, define viral tweets as the top 0.1% by quote_tweet_count. Randomly sample 100 viral tweets, label hook_type, emotional_tone, and controversy_level with strict JSON, then produce a bar chart and 10 representative examples.
```

## Intention

The user has supplied enough specifics and expects execution or a clear block.

## Correct Outcome

`research` preserves the exact design, starts the appropriate run if possible, or reports a concrete block. It should return run status and expected artifacts, not ask broad planning questions.

## Judge For

Did it start or block appropriately, preserve the requested metric/sample/labels/outputs, show expected artifacts, and avoid unnecessary clarification?
