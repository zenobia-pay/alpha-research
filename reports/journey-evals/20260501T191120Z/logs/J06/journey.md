# J06: File-To-Dataset Confusion

## Prompt

```text
I have a CSV of customer support tickets on my desktop. How do I turn it into something I can research here?
```

## Intention

The user wants onboarding from raw file to usable dataset but has not provided a path or schema.

## Correct Outcome

`research` asks for the absolute file path and a short description of the data. It briefly explains the next steps: infer schema, choose dataset name/id, normalize, and deploy. It should not pretend it can ingest without the file path.

## Judge For

Did it ask for the minimum missing information, make the path requirement clear, avoid a long setup tutorial, and explain the next step in user terms?
