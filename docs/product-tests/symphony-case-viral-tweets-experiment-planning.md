# symphony case: viral tweets experiment planning

## Product Use

A user asks for an experiment on what types of tweets go viral.

## Why This Test

This captures the acceptance behavior for viral-tweets planning: the product should scope the experiment before spending compute or launching labeling work.

## Actions Taken

The product lists remote datasets, inspects `enriched-tweets`, and proposes a scoped experiment design before launching work.

## Assertions Made

- Existing datasets are listed.
- The selected tweets dataset is inspected before the plan is proposed.
- The response names `enriched-tweets`.
- Viral tweets are defined as the top `0.1%` by `quote_tweet_count`.
- The plan samples `100` random viral tweets.
- The plan labels `hook_type`, `emotional_tone`, and `controversy_level`.
- Bar charts and representative examples are included in the expected outputs.
- The product asks the user to choose a virality rule and waits for approval before starting a run.
- Query, run-start, labeling, and agent-run tools are not called.
