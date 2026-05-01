# P04: Topic To Dataset Recommendation

## Prompt

```text
I want to research housing affordability. Which dataset should I use, or do I need to build a new one?
```

## Intention

The user has a topic and needs help choosing whether existing data is sufficient.

## Correct Outcome

`research` checks actual available datasets, ranks relevant choices, explains fit and gaps, and only suggests new public sources or a new dataset build after anchoring to existing inventory.

## Judge For

Did it anchor recommendations to real datasets first, explain why one fits or does not fit, avoid generic public-source planning as the first answer, and ask only focused follow-up questions?
