# Research Journey Evaluation Spec

This document defines canonical `research` user journeys, a capture script contract for running each journey, and a Codex judge prompt for reviewing the resulting Ink terminal logs and screenshot time series.

The goal is to evaluate whether `research` behaves like a useful dataset-backed research agent for a human user: when it should ask for clarification, when it should start work, what information it displays, and whether the user can understand the current state.

## Capture Script Contract

The journey runner should produce one directory per run:

```text
.tmp/journey-runs/<journey-id>/<timestamp>/
  journey.md              # copied journey definition
  input.json              # exact prompt, env, command, and setup notes
  terminal.log            # raw terminal transcript
  events.jsonl            # timestamped typed input, process output markers, exit status
  screenshots/
    0000-start.png
    0001-5s.png
    0002-10s.png
    ...
    final.png
  metadata.json           # git sha, branch, command, terminal size, elapsed time
```

Recommended script shape:

```bash
#!/usr/bin/env bash
set -euo pipefail

journey_id="$1"
prompt_file="$2"
out_root="${3:-.tmp/journey-runs}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
out_dir="$out_root/$journey_id/$timestamp"

mkdir -p "$out_dir/screenshots"

# Suggested environment:
# - fixed terminal size, e.g. 120x36
# - isolated RESEARCH_SESSION_DIR when testing auth-independent journeys
# - RESEARCH_DISABLE_RUN_WATCHER=1 only when the journey explicitly needs deterministic harness behavior
# - real session only for live product runs that need remote state

# Pseudocode implementation:
# 1. Launch `research` or `npm run cli` in a real PTY.
# 2. Start transcript capture into terminal.log.
# 3. Take a screenshot immediately.
# 4. Type the journey prompt exactly as written.
# 5. Take screenshots every 5 seconds and after each visible state transition.
# 6. Stop when the journey reaches a terminal state, asks a clarification question, starts a run, or hits timeout.
# 7. Write metadata.json and events.jsonl.
```

Judgment should use both logs and screenshots. Logs preserve exact text; screenshots preserve what was visually salient in the Ink UI.

## Global Judgment Rubric

For every journey, judge:

- **Input burden:** exact number of user messages/commands and whether the user had to know hidden ids, internal commands, or implementation terms.
- **Intent recognition:** whether `research` correctly inferred the user's goal.
- **Decision behavior:** whether it asked for clarification, proposed a plan, started work, retrieved results, or reported a block; and whether that decision matched the journey.
- **Displayed information:** what was visible in the Ink UI: datasets, ids, status, run links, plans, artifacts, errors, next steps.
- **State clarity:** whether the user could tell if work was unstarted, awaiting confirmation, running, blocked, failed, reconciling, or complete.
- **Information density:** whether the screen showed too little, the right amount, or too much detail.
- **Recovery clarity:** for blocked, auth, busy, failed, or stuck states, whether the next action was obvious.
- **Artifact clarity:** when artifacts are expected or produced, whether names, links, and status were visible.
- **Continuity:** whether the user could resume without remembering exact run ids.
- **Pass/fail:** whether the journey met the correct outcome.

## Codex Journey Judge Prompt

Use this prompt with the captured run directory and the journey definition.

```text
You are judging the UX of the `research` Ink CLI for one canonical user journey.

Inputs:
- Journey definition: intention, prompt, correct outcome, and judgment criteria.
- terminal.log: raw terminal transcript.
- events.jsonl: timestamped input/output markers.
- screenshots/: time series screenshots of the terminal UI.
- metadata.json: command, environment, terminal size, elapsed time, git sha.

Your job:
1. Reconstruct what the user experienced from the screenshots first, then use logs to verify exact text.
2. Decide whether `research` chose the right behavior: clarify, plan, start work, retrieve, wait, report block, or debug.
3. Identify every confusing moment visible to a normal user. Be concrete: quote or paraphrase the visible text and reference screenshot filenames/timestamps.
4. Separate product confusion from dataset confusion, auth confusion, run lifecycle confusion, and terminal/UI readability problems.
5. Judge whether the displayed information was too sparse, right-sized, or too dense for this journey.
6. Produce a briefing with:
   - Verdict: Pass, Partial, or Fail.
   - User input burden: number of messages/commands and any hidden knowledge required.
   - Correct behavior assessment.
   - Confusing moments, ordered by severity.
   - Missing information that would have helped.
   - Information that should be removed or de-emphasized.
   - Suggested UI/output changes.
   - Evidence references to screenshots/log timestamps.

Do not judge backend correctness beyond what the user could observe unless logs prove the UI contradicted the actual state. Focus on what a user would understand from the Ink CLI.
```

## Journeys

### J01: Product Orientation

Prompt:

```text
What can you help me do?
```

Intention:
The user has opened `research` without understanding the product.

Correct outcome:
`research` explains itself as a dataset-backed research agent in plain language. It names concrete actions: create a dataset from a file, list datasets, inspect or brief a dataset, design an experiment, run analysis, and retrieve artifacts. It should not dump internal architecture.

Judge for:
Did the screen answer in user language, show 3-5 useful next actions, avoid overwhelming technical detail, and avoid requiring terms like remote run, manifest, or mounted dataset?

### J02: Dataset Inventory

Prompt:

```text
What datasets do I have?
```

Intention:
The user wants to orient around available data before choosing work.

Correct outcome:
`research` lists datasets with human names, ids, status, and short descriptions when available. It distinguishes ready, draft, building, local, and remote datasets where relevant. It suggests a natural next step like describing or analyzing one dataset.

Judge for:
Was the list scannable, did each dataset have enough context to choose from, did it over-index on ids, and was local/remote readiness clear?

### J03: Dataset Selection From Topic

Prompt:

```text
I want to study housing affordability. Which dataset should I use?
```

Intention:
The user has a topic but not a dataset id.

Correct outcome:
`research` inspects or lists datasets, identifies likely relevant datasets, explains why, and asks for confirmation if multiple choices are plausible. It should not launch expensive work unless there is one obvious low-cost next step.

Judge for:
Did it use dataset metadata instead of guessing, explain tradeoffs, ask a focused follow-up only if needed, and avoid making the user know exact dataset ids?

### J04: Dataset Briefing

Prompt:

```text
Describe the econ dataset for me.
```

Intention:
The user wants a briefing before trusting or analyzing a dataset.

Correct outcome:
`research` starts or returns a dataset briefing scoped to inventory and documentation. It requests or shows artifacts like `Dataset Briefing` and `Dataset Profile`, with fields, measures, time coverage, source coverage, row counts, and limitations. It should not drift into open-ended analysis.

Judge for:
Did it stay in briefing mode, make async status clear, help the user understand dataset fitness, and make artifacts or links prominent?

### J05: Field Meaning And Research Fit

Prompt:

```text
In the tweets dataset, what does quote_tweet_count mean and can I use it to define virality?
```

Intention:
The user understands the dataset somewhat but is unsure about one metric and its research meaning.

Correct outcome:
`research` inspects metadata if needed, explains the field in context, says whether it is suitable as a proxy, and states limitations. It should not start an experiment.

Judge for:
Did it answer the concept question before proposing work, distinguish field definition from experiment design, offer a concrete next step, and surface uncertainty if metadata is insufficient?

### J06: File-To-Dataset Confusion

Prompt:

```text
I have a CSV of customer support tickets on my desktop. How do I turn it into something I can research here?
```

Intention:
The user wants onboarding from raw file to usable dataset but has not provided a path or schema.

Correct outcome:
`research` asks for the absolute file path and a short description of the data. It briefly explains the next steps: infer schema, choose dataset name/id, normalize, and deploy. It should not pretend it can ingest without the file path.

Judge for:
Did it ask for the minimum missing information, make the path requirement clear, avoid a long setup tutorial, and explain the next step in user terms?

### J07: Create Dataset From File

Prompt:

```text
Create a dataset from /Users/me/Downloads/enriched_tweets.parquet. It contains tweets, authors, timestamps, text, and engagement counts. Name it Enriched Tweets and deploy it.
```

Intention:
The user gives enough concrete information to start dataset creation.

Correct outcome:
`research` proceeds without unnecessary clarification. It confirms inferred id/name if useful, starts creation/upload/deploy work, and displays dataset id, run or deploy status, and the next useful action.

Judge for:
Did it avoid questions already answered, clearly show progress, expose errors with recovery steps, and distinguish dataset creation from deployment?

### J08: Vague Viral Tweets Experiment

Prompt:

```text
What’s up with tweets? Can you run an experiment for me on what types of tweets go viral?
```

Intention:
The user wants an experiment but has not defined outcome, population, sample size, labeling approach, or outputs.

Correct outcome:
`research` should not start expensive work. It should inspect the relevant dataset, turn the vague idea into a concrete proposed experiment, define virality, propose labels and outputs, and ask for approval.

Judge for:
Did it stop before launching a run, convert ambiguity into a precise plan, include falsifiable choices like metric/threshold/sample size/labels/charts, and ask a clear confirmation question?

### J09: Specific Viral Tweets Experiment

Prompt:

```text
Using enriched-tweets, define viral tweets as the top 0.1% by quote_tweet_count. Randomly sample 100 viral tweets, label each for hook_type, emotional_tone, and controversy_level using strict JSON, then produce a bar chart and 10 representative examples.
```

Intention:
The user supplies dataset, metric, threshold, sample size, labeling fields, and outputs.

Correct outcome:
`research` kicks off the run. It requires mounted dataset grounding, starts analysis/labeling work, returns run id/status/artifact expectations, and only asks a question if the dataset or fields are missing.

Judge for:
Did it start rather than over-clarify, preserve the exact design, show run id and expected artifacts, and warn if fields were unavailable?

### J10: Vague Housing Market Question

Prompt:

```text
Can you look into whether the housing market is in trouble?
```

Intention:
The user has a broad topic and vague criterion.

Correct outcome:
`research` asks for clarification or proposes a concrete study design before running. It may suggest definitions like affordability stress, price/rent divergence, mortgage delinquency, inventory, region, and time period. It should not immediately start a broad public-data build.

Judge for:
Did it recognize underspecification, offer useful operationalizations, ask for the smallest decision needed to proceed, and avoid a runaway expensive task?

### J11: Specific Housing Dataset Build

Prompt:

```text
Make me a county-month economics dataset for testing a housing-cycle hypothesis from 2015 to 2025. Include FRED rates, Census population/income, Zillow home values and rents, BLS employment/unemployment/CPI, FHFA HPI, and NBER recession indicators. Validate source URLs, row counts, missingness, join keys, temporal coverage, and produce a data dictionary and manifest.
```

Intention:
The user specifies scope, grain, time range, sources, validation, and artifacts.

Correct outcome:
`research` checks existing datasets, then creates a research environment/build run with the specified acquisition and validation plan. It returns dataset id, run id, and expected artifacts.

Judge for:
Did it proceed without broad follow-ups, preserve source and validation requirements, show a concise reviewable plan, and make async status and artifact expectations clear?

### J12: Vague Analysis On Known Dataset

Prompt:

```text
Analyze the econ dataset and tell me what’s interesting.
```

Intention:
The user selected a dataset but not a research question.

Correct outcome:
`research` should not launch a broad analysis blindly. It should offer a dataset briefing plus suggested research directions, or ask which outcome/domain matters. If it proposes exploratory profiling, it should make scope and cost clear.

Judge for:
Did it avoid pretending "interesting" is precise, offer useful research angles, ask a focused question, and keep the user in control of expensive work?

### J13: Specific Analysis On Known Dataset

Prompt:

```text
Using the econ dataset, compare county-level unemployment changes against home value growth from 2019 through 2024. Group by county and year, create a correlation table, a scatter plot, and a short markdown summary with caveats.
```

Intention:
The user supplies dataset, variables, time window, grouping, outputs, and interpretation format.

Correct outcome:
`research` starts the analysis run, or first verifies field names if necessary. It returns run id/status and expected table, chart, and summary artifacts.

Judge for:
Did it ask only field-resolution questions if needed, start the run when enough information existed, keep the user oriented during async work, and make expected artifacts clear?

### J14: Return To Last Run

Prompt:

```text
Show me the results from my last run.
```

Intention:
The user does not remember the run id and wants continuity.

Correct outcome:
`research` uses tracked run state, identifies the latest relevant run, reports status, and retrieves results/artifacts if complete. If multiple candidates exist, it shows a small choice list.

Judge for:
Did the user need to remember a run id, did it show which run was selected, were artifacts visible, and did it handle running/failed/completed states differently?

### J15: Stuck Run Confusion

Prompt:

```text
My last run seems stuck. What’s happening?
```

Intention:
The user is confused by async status and wants diagnosis, not raw logs.

Correct outcome:
`research` inspects active/tracked runs, shows current status/events, explains whether it is queued, running, reconciling, failed, or complete, and provides a next action: wait, debug, cancel, retry, or inspect artifacts.

Judge for:
Did it explain state in plain language, include enough evidence without dumping JSON, offer an actionable next step, and avoid falsely declaring failure when state is uncertain?

### J16: Busy Dataset Conflict

Prompt:

```text
Run a new analysis on enriched-tweets.
```

Setup:
The dataset already has an active blocking run.

Intention:
The user wants work done but does not know the dataset is locked.

Correct outcome:
`research` reports the conflict, identifies the blocking run, shows status/link, and suggests waiting, inspecting, or cancelling if appropriate. It should not start duplicate competing work.

Judge for:
Was the conflict obvious, did it identify the blocking run, did it explain why no new run started, and was the next action clear?

### J17: Signed-Out Remote Request

Prompt:

```text
Show my remote datasets.
```

Setup:
No valid session.

Intention:
The user wants data, but auth is missing.

Correct outcome:
`research` explains that sign-in is required, gives the exact `research login` action or starts login if appropriate, and preserves the user's intent for after auth if possible.

Judge for:
Did it explain auth in product terms, make login visible and simple, avoid exposing session internals, and clarify whether the original task must be retried?

### J18: Failed Run Artifact Salvage

Prompt:

```text
Debug the failed housing dataset run and tell me whether it produced any usable artifacts.
```

Intention:
The user cares less about stack traces and more about salvageable output.

Correct outcome:
`research` inspects run status/events/artifacts, distinguishes failure from worker uncertainty, summarizes what artifacts exist, what is missing, and whether retry or resume is possible.

Judge for:
Did it prioritize artifacts and user impact over internal logs, redact sensitive information, separate known facts from uncertainty, and recommend a concrete next action?

