# J03 UX Briefing: Dataset Selection From Topic

## Verdict

Partial.

`research` chose the broadly right behavior at the start: it retrieved dataset metadata with `list_remote_datasets`, avoided launching an expensive run, and asked follow-up questions because "housing affordability" can mean several different measures. However, the final answer did not visibly use the actual seven remote datasets it found. It listed many public data sources, including sources that may not be present in the system, so a normal user would not know which dataset inside `research` they should actually pick.

## User Input Burden

Moderate to high.

The user asked a natural topic-level question: "I want to study housing affordability. Which dataset should I use?" The CLI responded with three clarification dimensions plus a final either/or about spinning up a "Housing Affordability Core" environment versus starting with one source. That is a lot of choice for a user who explicitly does not know the dataset id yet.

The better burden would be one recommended dataset, one or two alternatives, and a focused confirmation question such as: "For city/county affordability, start with X. If you need household-level burden, use Y. Which direction matches your study?"

## Correct Behavior Assessment

The initial behavior was correct:

- At 2.83s and 3.48s, stdout showed progress: `Calling list_remote_datasets` and `Found 7 remote datasets` (`events.jsonl`).
- The 5s through 35s snapshots all show the same two status lines (`snapshots/0001-5s.txt` through `snapshots/0007-35s.txt`), confirming it retrieved/listed before answering.
- It did not start a run or perform expensive work.
- It recognized ambiguity and asked for clarification.

The final behavior was only partially correct:

- The answer recommends broad source families: Zillow, Redfin, Census ACS, HUD CHAS/FMR, NLIHC, FHFA, Freddie Mac, and BLS CPI (`snapshots/0008-final.txt`, `terminal.log`).
- It does not name the actual dataset ids or dataset titles among the seven remote datasets.
- It says it can "spin up a Housing Affordability Core environment" but the journey asked which dataset to use, not to create a multi-source environment.
- It does not explain whether "Housing Affordability Core" is an existing dataset, a new run, or a proposed bundle.

## Confusing Moments, Ordered By Severity

1. **The final answer is not anchored to the datasets actually available in `research`.**

   Evidence: `snapshots/0008-final.txt` lists public sources, but no `research` dataset ids, slugs, or names. The progress line says "Found 7 remote datasets," yet the answer does not reveal what those seven were. A user cannot confidently choose a dataset from the product.

2. **The CLI waits silently for about 33 seconds after finding datasets.**

   Evidence: `events.jsonl` shows dataset status printed by 3.477s, then snapshots at 5s, 10s, 15s, 20s, 25s, 30s, and 35s are identical. The final answer appears at 36.503s. From the user's perspective, the tool may look stalled after "Found 7 remote datasets."

3. **The response asks too many clarification questions before giving a product-specific recommendation.**

   Evidence: final output asks for geography, metric, and period/frequency, then also asks whether to spin up a core environment or start with one source (`snapshots/0008-final.txt`). This is reasonable analytically, but heavy for a dataset-selection journey.

4. **"I can spin up a Housing Affordability Core environment" introduces an unclear next action.**

   Evidence: final line in `snapshots/0008-final.txt` and `terminal.log`. It is unclear whether this launches a remote run, creates a dataset, costs time/money, or simply documents a plan. It also shifts from "which dataset should I use?" to "create an environment."

5. **Terminal wrapping damages readability at the final call to action.**

   Evidence: `screenshots/0008-final.svg` wraps "and" across lines as `an` / `d` in the sentence about ACS + HUD + Zillow/Redfin + FHFA + CPI/PMMS. The same split appears in the text snapshot as a hard wrap. This is a small but visible polish issue at the most important decision point.

## Confusion Categories

### Product Confusion

High. The product says it found seven remote datasets, but the answer does not expose the available dataset names or ids. The user still does not know what to select inside `research`.

### Dataset Confusion

High. The final answer includes many plausible housing data sources, but it does not distinguish "available now in this CLI" from "external sources you might want." It also mixes primary datasets, indexes, controls, and microdata without ranking them against the user's likely use case.

### Auth Confusion

None visible. There were no login prompts, token errors, permission errors, or unclear auth states in the snapshots, logs, or events.

### Run Lifecycle Confusion

Moderate. No run was launched, which is good. But "spin up a Housing Affordability Core environment" sounds like a new workflow or run without explaining what will happen next.

### Terminal/UI Readability Problems

Moderate. The screen is sparse during the wait, then dense at the end. The final sentence wraps awkwardly in `screenshots/0008-final.svg`, and the CLI provides no intermediate "thinking/searching/ranking" state between dataset retrieval and final answer.

## Information Density Judgment

Too sparse during the wait, then too dense in the final answer.

During 5s-35s, the visible UI only says:

- `Calling list_remote_datasets`
- `Found 7 remote datasets.`

That is too sparse for a 36.7s journey (`metadata.json`). The final answer then lists nine sources plus microdata plus four follow-up choices. For a topic-to-dataset journey, that is more information than needed and lacks the one thing the user most needs: the best available `research` dataset choice.

## Missing Information That Would Have Helped

- The names and ids/slugs of the seven remote datasets found.
- A ranked recommendation based on those datasets.
- A short reason for the top pick, using actual metadata such as coverage, geography, time range, variables, and freshness.
- A clear distinction between available datasets and suggested external sources.
- A focused next step: "Use dataset X?" or "Choose A for renters, B for home prices."
- Progress during the long wait, such as "Ranking datasets by housing affordability relevance..."

## Information To Remove Or De-emphasize

- De-emphasize sources that are not among the seven remote datasets.
- Remove or shorten the broad "Quick picks" taxonomy unless it is tied to actual available dataset entries.
- Avoid the "Housing Affordability Core environment" offer unless the CLI can explain what action it will take and whether it is an existing workflow.
- Reduce the clarification list from three broad questions to one focused decision point.

## Suggested UI/Output Changes

1. After `Found 7 remote datasets`, show a ranking step if the model is taking more than a few seconds:

   `Ranking 7 datasets for housing affordability...`

2. Make the final answer product-specific:

   `Best match: <dataset name> (<dataset id>)`

   Then include one sentence on why it fits and one sentence on when to choose the runner-up.

3. Separate existing datasets from external suggestions:

   `Available in research:` followed by ranked entries.

   `Useful external complements:` only if needed.

4. Ask one focused follow-up:

   `Are you studying renter burden or home purchase affordability?`

5. Avoid ambiguous action wording:

   Replace "spin up a Housing Affordability Core environment" with a concrete command/action preview, or remove it from this journey.

6. Improve wrapping for long final lines, especially the call to action. The awkward split in `screenshots/0008-final.svg` makes the final choice harder to read.

## Evidence References

- Prompt and intended correct outcome: `journey.md`.
- Command and timeout: `input.json`.
- Runtime and exit status: `metadata.json` shows `elapsedMs: 36719`, exit code 0.
- Initial visible state: `snapshots/0000-start.txt` is blank.
- Dataset retrieval state: `snapshots/0001-5s.txt` through `snapshots/0007-35s.txt` all show only `Calling list_remote_datasets` and `Found 7 remote datasets.`
- Timing: `events.jsonl` shows first two stdout events at 2.830s and 3.477s, final answer stdout at 36.503s.
- Final answer text: `snapshots/0008-final.txt` and `terminal.log`.
- Final visual wrap issue: `screenshots/0008-final.svg`, lines showing `... CPI/PMMS an` then `d document joins`.
