# J11: Specific Housing Dataset Build

## Prompt

```text
Make me a county-month economics dataset for testing a housing-cycle hypothesis from 2015 to 2025. Include FRED rates, Census population/income, Zillow home values and rents, BLS employment/unemployment/CPI, FHFA HPI, and NBER recession indicators. Validate source URLs, row counts, missingness, join keys, temporal coverage, and produce a data dictionary and manifest.
```

## Intention

The user specifies scope, grain, time range, sources, validation, and artifacts.

## Correct Outcome

`research` checks existing datasets, then creates a research environment/build run with the specified acquisition and validation plan. It returns dataset id, run id, and expected artifacts.

## Judge For

Did it proceed without broad follow-ups, preserve source and validation requirements, show a concise reviewable plan, and make async status and artifact expectations clear?
