# async query run returns immediately with canonical dashboard and terminal links

## Product Use

A user asks for viral tweets from `enriched-tweets`.

## Why This Test

This protects the product promise that quick dataset questions start trackable work without making the user wait, while still grounding the run in the intended dataset instead of silently substituting outside data.

## Actions Taken

The product starts a query run against `enriched-tweets`, returns immediately, and gives the user both the dashboard run link and terminal-session link so they can follow progress.

## Assertions Made

- A query run is started.
- The response includes the canonical dashboard run URL.
- The response includes the canonical terminal-session URL.
- The run prompt requires mounted dataset grounding.
- The run config requires mounted dataset grounding for `enriched-tweets`.
- The workflow must fail loudly if mounted data cannot be read.
- The workflow must not use public sample data, GitHub CSVs, or external fallback data.
