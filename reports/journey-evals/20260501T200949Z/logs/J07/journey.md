# J07: Create Dataset From File

## Prompt

```text
Create a dataset from /Users/me/Downloads/enriched_tweets.parquet. It contains tweets, authors, timestamps, text, and engagement counts. Name it Enriched Tweets and deploy it.
```

## Intention

The user gives enough concrete information to start dataset creation.

## Correct Outcome

`research` proceeds without unnecessary clarification. It confirms inferred id/name if useful, starts creation/upload/deploy work, and displays dataset id, run or deploy status, and the next useful action.

## Judge For

Did it avoid questions already answered, clearly show progress, expose errors with recovery steps, and distinguish dataset creation from deployment?
