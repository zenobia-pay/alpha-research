# symphony case: viral tweets experiment planning

## Product Use

A user asks for an experiment on what types of tweets go viral.

## Actions Taken

The product finds `enriched-tweets` and proposes a scoped experiment design before launching work.

## Assertions Made

- Existing datasets are listed.
- The response names `enriched-tweets`.
- Viral tweets are defined as the top `0.1%` by `quote_tweet_count`.
- The plan samples `100` random viral tweets.
- The plan uses strict JSON labeling.
- Visualizations and control-group alternatives are mentioned.
- The product asks whether to proceed.
- Query, run-start, labeling, and agent-run tools are not called.
