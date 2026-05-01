# J04: Dataset Briefing

## Prompt

```text
Describe the econ dataset for me.
```

## Intention

The user wants a briefing before trusting or analyzing a dataset.

## Correct Outcome

`research` starts or returns a dataset briefing scoped to inventory and documentation. It requests or shows artifacts like `Dataset Briefing` and `Dataset Profile`, with fields, measures, time coverage, source coverage, row counts, and limitations. It should not drift into open-ended analysis.

## Judge For

Did it stay in briefing mode, make async status clear, help the user understand dataset fitness, and make artifacts or links prominent?
