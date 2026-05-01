# P08: Return Later For Continuity

## Prompt

```text
I came back later. What happened with my research work, and what results or artifacts can I see?
```

## Intention

The user expects continuity without remembering run ids.

## Correct Outcome

`research` distinguishes active, completed, failed, and blocked recent work; summarizes the latest relevant run; and points to results/artifacts or clear next actions without dumping raw prompts or JSON.

## Judge For

Did it recover state without requiring ids, distinguish active versus completed work, summarize artifacts cleanly, and avoid overwhelming run internals?
