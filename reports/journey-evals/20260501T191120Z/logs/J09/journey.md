# J09: Specific Viral Tweets Experiment

## Prompt

```text
Using enriched-tweets, define viral tweets as the top 0.1% by quote_tweet_count. Randomly sample 100 viral tweets, label each for hook_type, emotional_tone, and controversy_level using strict JSON, then produce a bar chart and 10 representative examples.
```

## Intention

The user supplies dataset, metric, threshold, sample size, labeling fields, and outputs.

## Correct Outcome

`research` kicks off the run. It requires dataset setup, starts analysis/labeling work, returns run id/status/artifact expectations, and only asks a question if the dataset or fields are missing.

## Judge For

Did it start rather than over-clarify, preserve the exact design, show run id and expected artifacts, and warn if fields were unavailable?
