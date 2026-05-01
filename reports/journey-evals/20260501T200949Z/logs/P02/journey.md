# P02: Raw File To Research Dataset

## Prompt

```text
I have a CSV export of customer support tickets. I want to turn it into a dataset I can research here, but I don't know what you need from me.
```

## Intention

The user has data somewhere and wants help turning it into a usable research dataset, but has not provided a path or schema.

## Correct Outcome

`research` asks for the absolute file path and a short data description, explains the intake steps in user language, and does not pretend it can import without a path.

## Judge For

Did it ask for the minimum missing information, explain the path requirement, describe what will happen next, and avoid a long installation or ingestion tutorial?
