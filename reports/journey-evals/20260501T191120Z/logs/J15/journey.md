# J15: Stuck Run Confusion

## Prompt

```text
My last run seems stuck. What’s happening?
```

## Intention

The user is confused by async status and wants diagnosis, not raw logs.

## Correct Outcome

`research` inspects active/tracked runs, shows current status/events, explains whether it is queued, running, reconciling, failed, or complete, and provides a next action: wait, debug, cancel, retry, or inspect artifacts.

## Judge For

Did it explain state in plain language, include enough evidence without dumping JSON, offer an actionable next step, and avoid falsely declaring failure when state is uncertain?
