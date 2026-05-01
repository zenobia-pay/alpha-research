# J13: Specific Analysis On Known Dataset

## Prompt

```text
Using the econ dataset, compare county-level unemployment changes against home value growth from 2019 through 2024. Group by county and year, create a correlation table, a scatter plot, and a short markdown summary with caveats.
```

## Intention

The user supplies dataset, variables, time window, grouping, outputs, and interpretation format.

## Correct Outcome

`research` starts the analysis run, or first verifies field names if necessary. It returns run id/status and expected table, chart, and summary artifacts.

## Judge For

Did it ask only field-resolution questions if needed, start the run when enough information existed, keep the user oriented during async work, and make expected artifacts clear?
