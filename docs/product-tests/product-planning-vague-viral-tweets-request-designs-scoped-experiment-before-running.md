# product planning: vague viral tweets request designs scoped experiment before running

## Product Use

A user asks, "what's up with tweets? Can you run an experiment for me on what types of tweets go viral?"

## Why This Test

This prevents expensive work from starting from an underspecified research question. The product should convert ambiguity into a concrete experiment design and ask for confirmation.

## Actions Taken

The product inspects `enriched-tweets` and turns the vague request into a concrete experiment design. It stops for confirmation instead of launching expensive work immediately.

## Assertions Made

- `enriched-tweets` is inspected.
- No run is started before confirmation.
- The plan says the request needs an operational definition.
- Viral tweets are defined as the top `0.1%` by `quote_tweet_count`.
- The plan samples `100` random viral tweets.
- The plan includes strict JSON labeling.
- Required fields include `hook_type` and `controversy_level`.
- Visual outputs include a bar chart and representative examples.
- The product asks whether the design looks good.
- Alternatives such as retweets/likes and a control group are offered.
