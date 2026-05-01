# J14: Return To Last Run

## Prompt

```text
Show me the results from my last run.
```

## Intention

The user does not remember the run id and wants continuity.

## Correct Outcome

`research` uses tracked run state, identifies the latest relevant run, reports status, and retrieves results/artifacts if complete. If multiple candidates exist, it shows a small choice list.

## Judge For

Did the user need to remember a run id, did it show which run was selected, were artifacts visible, and did it handle running/failed/completed states differently?
