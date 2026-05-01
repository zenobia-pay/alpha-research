# J03: Dataset Selection From Topic

## Prompt

```text
I want to study housing affordability. Which dataset should I use?
```

## Intention

The user has a topic but not a dataset id.

## Correct Outcome

`research` inspects or lists datasets, identifies likely relevant datasets, explains why, and asks for confirmation if multiple choices are plausible. It should not launch expensive work unless there is one obvious low-cost next step.

## Judge For

Did it use dataset metadata instead of guessing, explain tradeoffs, ask a focused follow-up only if needed, and avoid making the user know exact dataset ids?
