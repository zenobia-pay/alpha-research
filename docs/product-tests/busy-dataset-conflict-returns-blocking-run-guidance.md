# busy dataset conflict returns blocking run guidance

## Product Use

A user starts analysis on a dataset that is already locked by another active run.

## Actions Taken

The product reports the conflict and tells the user which run is blocking the dataset. It points the user to the dashboard page for that blocking run instead of hiding the conflict or starting duplicate work.

## Assertions Made

- The busy dataset condition is detected.
- The blocking run id is shown.
- A dashboard link for the blocking run is shown.
- No replacement run is presented as if it succeeded.
