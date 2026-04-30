# test:slow:tweets

## Product Use

A user asks what kinds of tweets go viral and approves the proposed experiment.

## Actions Taken

The product finds and uses `enriched-tweets`, reads mounted dataset files, defines viral tweets as the top `0.1%` by `quote_tweet_count`, samples `100` random viral tweets, labels sampled tweets with strict JSON fields, creates charts and representative examples, waits for completion, and retrieves artifacts.

## Assertions Made

- The workflow uses `enriched-tweets`.
- Mounted dataset grounding is mandatory.
- If mounted data cannot be read, the workflow must fail loudly.
- Runtime evidence must not contain GitHub/raw CSV/sample fallback usage.
- Viral is defined as top `0.1%` by `quote_tweet_count`.
- `100` random viral tweets are sampled.
- Strict JSON labeling is used.
- Label fields include `hook_type`, `emotional_tone`, and `controversy_level`.
- Visualizations and representative examples are produced.
- At least one run reaches terminal success.
- Artifacts are produced.
