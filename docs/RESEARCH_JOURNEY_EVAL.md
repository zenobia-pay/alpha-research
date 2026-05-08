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

The `Jxx` journeys exercise one-shot prompt mode, equivalent to:

```bash
research --prompt "<prompt>"
```

They are useful for scripted behavior, but they do not show the interactive yellow/green Ink TUI. The `TUIxx` journeys below exercise the true interactive app, equivalent to launching `research` with no prompt and typing inside the TUI.

Run the interactive TUI journeys with:

```bash
python3 scripts/run-tui-journey-evals.py --out=.tmp/tui-journey-runs
```

This runner launches `node apps/cli/dist/index.js` in a real PTY, types each journey's messages into the Ink UI, saves raw terminal logs, text snapshots, SVG screenshots with ANSI colors, and a Codex judge briefing for each run. Useful timing/viewport knobs:

```bash
TUI_JOURNEY_WIDTH=120
TUI_JOURNEY_HEIGHT=36
TUI_JOURNEY_SNAPSHOT_SECONDS=3
TUI_JOURNEY_AFTER_MESSAGE_SECONDS=18
TUI_JOURNEY_TIMEOUT_SECONDS=180
TUI_JOURNEY_JUDGE_MODEL=gpt-5.4-mini
```

For a quick smoke run without judge briefings:

```bash
TUI_JOURNEY_TIMEOUT_SECONDS=20 TUI_JOURNEY_AFTER_MESSAGE_SECONDS=5 \
  python3 scripts/run-tui-journey-evals.py --journeys=TUI01 --no-judge --out=.tmp/tui-journey-runs-smoke
```

The `Pxx` journeys are product-job journeys. They cover the holistic reasons somebody opens `research`: orient, ingest data, choose data, map topic to data, understand data, design research, run precise work, return later, and recover blocked work. They are runnable through the same prompt-mode journey runner:

```bash
npx tsx scripts/run-journey-evals.ts --suite=product --out=.tmp/journey-runs-product
```

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
`research` kicks off the run against the selected dataset, starts analysis/labeling work, returns run id/status/artifact expectations, and only asks a question if the dataset or fields are missing.

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

## Product-Job Journeys

These are the product-level jobs-to-be-done for `research`. They are intentionally broader than the original J01-J18 diagnostic set and should be treated as the canonical product smoke suite.

### P01: Cold Start Product Orientation

Prompt:

```text
I just opened research. What is this, and what should I type first?
```

Intention:
The user does not understand the product and needs a fast orientation before doing any work.

Correct outcome:
`research` frames itself as a dataset-backed research agent, names concrete jobs it can do, and gives a few example prompts. It should avoid infrastructure terms, run lifecycle jargon, and raw command menus.

Judge for:
Did it explain the product in human terms, show clear first actions, keep the response short, and avoid making the user understand remote environments or artifacts before they need them?

### P02: Raw File To Research Dataset

Prompt:

```text
I have a CSV export of customer support tickets. I want to turn it into a dataset I can research here, but I don't know what you need from me.
```

Intention:
The user has data somewhere and wants help turning it into a usable research dataset, but has not provided a path or schema.

Correct outcome:
`research` asks for the absolute file path and a short data description, explains the intake steps in user language, and does not pretend it can import without a path.

Judge for:
Did it ask for the minimum missing information, explain the path requirement, describe what will happen next, and avoid a long installation or ingestion tutorial?

### P03: Choose From Existing Data

Prompt:

```text
What data do I already have that is ready to use?
```

Intention:
The user wants to choose a starting dataset from the inventory.

Correct outcome:
`research` lists available datasets with human names, readiness, local/remote distinction, descriptions or inferred purpose, and a recommended next action. Draft/test/noisy datasets should be de-emphasized or clearly labeled.

Judge for:
Could a normal user choose a dataset from the output, were readiness labels plain, were ids secondary, and was the next step obvious?

### P04: Topic To Dataset Recommendation

Prompt:

```text
I want to research housing affordability. Which dataset should I use, or do I need to build a new one?
```

Intention:
The user has a topic and needs help choosing whether existing data is sufficient.

Correct outcome:
`research` checks actual available datasets, ranks relevant choices, explains fit and gaps, and only suggests new public sources or a new dataset build after anchoring to existing inventory.

Judge for:
Did it anchor recommendations to real datasets first, explain why one fits or does not fit, avoid generic public-source planning as the first answer, and ask only focused follow-up questions?

### P05: Understand And Trust Dataset

Prompt:

```text
Before I use the econ dataset, help me understand what's inside it, where it came from, and whether I can trust it.
```

Intention:
The user wants dataset understanding and trust, not analysis.

Correct outcome:
`research` treats this as a dataset briefing/profile request: sources, schemas, coverage, row counts, quality checks, limitations, and artifacts. It should not drift into suggested analyses unless framed as optional follow-up.

Judge for:
Did it stay in understand/brief mode, surface trust signals, avoid analysis drift, and make briefing artifacts/status clear?

### P06: Vague Idea To Research Design

Prompt:

```text
I think certain kinds of tweets go viral, but I don't know how to test that. Can you help me turn it into a real experiment?
```

Intention:
The user has a fuzzy research idea and needs `research` to operationalize it before running.

Correct outcome:
`research` proposes a concrete experiment with dataset, outcome definition, sample, labels, outputs, and approval question. It should not start expensive work yet.

Judge for:
Did it slow down, convert ambiguity into falsifiable choices, avoid starting a run, and ask for a clear approval or choice?

### P07: Specific Research Request To Run

Prompt:

```text
Using enriched-tweets, define viral tweets as the top 0.1% by quote_tweet_count. Randomly sample 100 viral tweets, label hook_type, emotional_tone, and controversy_level with strict JSON, then produce a bar chart and 10 representative examples.
```

Intention:
The user has supplied enough specifics and expects execution or a clear block.

Correct outcome:
`research` preserves the exact design, starts the appropriate run if possible, or reports a concrete block. It should return run status and expected artifacts, not ask broad planning questions.

Judge for:
Did it start or block appropriately, preserve the requested metric/sample/labels/outputs, show expected artifacts, and avoid unnecessary clarification?

### P08: Return Later For Continuity

Prompt:

```text
I came back later. What happened with my research work, and what results or artifacts can I see?
```

Intention:
The user expects continuity without remembering run ids.

Correct outcome:
`research` distinguishes active, completed, failed, and blocked recent work; summarizes the latest relevant run; and points to results/artifacts or clear next actions without dumping raw prompts or JSON.

Judge for:
Did it recover state without requiring ids, distinguish active versus completed work, summarize artifacts cleanly, and avoid overwhelming run internals?

### P09: Blocked Or Failed Work Recovery

Prompt:

```text
Something seems blocked or failed. Tell me what is happening, whether anything useful was produced, and what I should do next.
```

Intention:
The user is anxious about stuck or failed work and wants diagnosis plus recovery.

Correct outcome:
`research` explains the observed state in plain language, separates known facts from uncertainty, identifies any blocking run or failure evidence, summarizes salvageable artifacts, and offers next actions such as wait, inspect, cancel, retry, or debug.

Judge for:
Did it prioritize user impact over logs, avoid lifecycle jargon, identify what did or did not start, surface useful artifacts, and recommend concrete recovery actions?

### P10: Mixed Source Intake Source Of Truth

Prompt:

```text
I have a private CSV export of support tickets, a public product changelog, and some API docs. I want one research dataset that lets me study whether launches increase ticket volume and resolution time. What do you need before you build it?
```

Intention:
The user describes a mixed-source research environment but has not provided the private file path, public URLs, API access details, or approval to start a build.

Correct outcome:
`research` should identify the missing sources of truth before building: absolute private-file path, changelog URL or file, API/docs URL and auth constraints, desired grain/time range, key fields, and approval to start. It should explain the intake lifecycle in product language and should not create a dataset yet.

Judge for:
Did it separate private file, public source, and API source requirements; ask only for source-of-truth inputs needed to proceed; avoid fake ingestion; and avoid starting remote work before the required sources and approval exist?

### P11: Dataset Readiness Verdict Before Analysis

Prompt:

```text
Can I trust the econ dataset enough to use it for a county-month housing affordability study, or do we need to fix it first?
```

Intention:
The user wants a readiness decision before spending effort on analysis.

Correct outcome:
`research` treats this as a readiness/trust briefing, not an analysis run. It should inspect or request a dataset briefing/profile and answer in terms of source coverage, schemas, row counts, time/geography coverage, join keys, missingness, limitations, and a clear usable-now/fix-first verdict.

Judge for:
Did it produce or request evidence for the trust verdict; make readiness explicit; distinguish known facts from missing evidence; and avoid launching the county-month study before the dataset fitness question is answered?

### P12: Ambiguous Costly Research Approval Gate

Prompt:

```text
Run whatever analysis you think is best on all my data and tell me the biggest business opportunities.
```

Intention:
The user asks for broad, potentially expensive work without selecting datasets, outcomes, scope, cost, or artifacts.

Correct outcome:
`research` should not start a broad remote run. It should first inventory candidate datasets or ask for the business objective, propose a scoped study with concrete datasets/outcomes/artifacts, and ask for approval before spending remote time.

Judge for:
Did it refuse to treat the vague request as sufficient execution scope; did it ask or inspect before running; did it propose a bounded study; and was approval clearly required before remote work?

### P13: Completed Work To Next Decision

Prompt:

```text
The last run finished. Explain what changed, what artifacts I have, whether the result is trustworthy, and what decision I should make next.
```

Intention:
The user wants the research-operator lifecycle to end in a decision, not just a run status.

Correct outcome:
`research` retrieves the latest completed run or asks for disambiguation, summarizes the original request, status, key outputs, artifact names/links, quality caveats, and 2-3 grounded next decisions. It should not dump raw JSON or require the user to remember a run id.

Judge for:
Did it bridge from run completion to human decision; did it make artifacts and caveats visible; did it preserve continuity without hidden ids; and did it recommend next actions grounded in actual outputs?

## Interactive TUI Journeys

These journeys must be captured in a real PTY with the interactive app open. The command under test is:

```bash
research
```

Local development equivalent:

```bash
node apps/cli/dist/index.js
```

The runner should wait for the Ink UI to render, capture the empty/initial screen, type the listed user messages into the TUI, press Enter after each message, and capture screenshots every 2-5 seconds plus after visible state transitions. These journeys specifically judge the yellow/green TUI layout, status panel, prompt input behavior, scrolling, wrapping, color semantics, and multi-turn continuity.

### TUI01: First Open Empty State

Typed messages:

```text
<none>
```

Intention:
The user has just opened `research` and has not typed anything yet.

Correct outcome:
The TUI immediately communicates what `research` is, whether there are active runs, and what the user can type next. The input area should be obvious. The screen should not look blank, broken, or like a generic terminal prompt.

Judge for:
Is the first screen self-explanatory, are colors legible, is the input target obvious, are active-run/status panels understandable, and does the UI avoid overwhelming a first-time user?

### TUI02: Orientation In TUI

Typed messages:

```text
What can you help me do?
```

Intention:
The user asks for product orientation from inside the interactive app.

Correct outcome:
The TUI shows the user message, a visible pending/thinking state, and a concise orientation answer. It should preserve readable layout after the response and keep the input area ready for the next prompt.

Judge for:
Does the user see that their message was submitted, is pending state visible, does the answer fit without awkward wrapping, and is the next input location clear?

### TUI03: Multi-Turn Dataset Discovery And Follow-Up

Typed messages:

```text
What datasets do I have?
Describe the tweets dataset.
```

Intention:
The user starts with inventory, then follows up using a dataset mentioned in the prior response.

Correct outcome:
The TUI should preserve conversational context, show the dataset inventory clearly, then interpret "tweets" as the dataset from the list. It should not force the user to restate ids if the prior response made the dataset obvious.

Judge for:
Can the user visually connect the follow-up to the previous answer, does scrolling preserve enough context, are tool/progress messages distinguishable from final answers, and does the input remain ergonomic?

### TUI04: Vague Idea Clarification Loop

Typed messages:

```text
What’s up with tweets? Can you run an experiment for me on what types of tweets go viral?
Use quote_tweet_count and sample 100 tweets.
```

Intention:
The user gives a vague experiment request, then answers the clarification/approval prompt.

Correct outcome:
The first turn should propose a concrete experiment without starting a run. The second turn should either start the run or ask only for genuinely missing details. The UI should make it visually obvious when work is only proposed versus when it has actually started.

Judge for:
Are "plan/proposal" and "run started" visually distinct, does the TUI avoid duplicate messages, and does the user understand whether expensive work has begun?

### TUI05: Specific Run Start And Active Status Panel

Typed messages:

```text
Using enriched-tweets, define viral tweets as the top 0.1% by quote_tweet_count. Randomly sample 100 viral tweets, label each for hook_type, emotional_tone, and controversy_level using strict JSON, then produce a bar chart and 10 representative examples.
```

Intention:
The user provides a specific analysis request and expects a run to start or a clear block.

Correct outcome:
The TUI should show progress through dataset lookup/start-run steps, then either show a run id/link/artifact expectations or a clear busy/blocking state. If a run starts, the active-run panel should update and remain understandable.

Judge for:
Does the active-run panel update, are status colors meaningful, are run ids/links readable without dominating the screen, and is the next action clear?

### TUI06: Busy Dataset Recovery In TUI

Typed messages:

```text
Run a new analysis on enriched-tweets.
```

Setup:
`enriched-tweets` has an active blocking run in tracked or backend state.

Intention:
The user tries to start work on a locked dataset.

Correct outcome:
The TUI should show a clear blocked state before presenting analysis options. It should identify the active run, explain that no new run was started, and offer recovery actions such as inspect, wait, cancel, or retry later.

Judge for:
Is the block visually prominent, does color communicate severity without ambiguity, are recovery actions clear, and does the UI avoid presenting normal analysis menus before resolving the lock?

### TUI07: Stuck Run From Active Status Panel

Typed messages:

```text
My last run seems stuck. What’s happening?
```

Setup:
At least one active tracked run is visible in the TUI status panel.

Intention:
The user sees the active run panel and asks for diagnosis.

Correct outcome:
The TUI should connect the answer to the visible active run, explain last update/heartbeat/current activity in plain language, and offer inspect/debug/wait/cancel actions.

Judge for:
Does the answer match the run shown in the panel, are stale/active states visually clear, and does the UI avoid raw lifecycle jargon?

### TUI08: Return Later And Retrieve Results

Typed messages:

```text
Show me the results from my last run.
```

Setup:
The tracked-run store contains at least one active run and one completed or failed run.

Intention:
The user expects continuity without remembering run ids.

Correct outcome:
The TUI should distinguish latest active run from last completed run. If ambiguous, it should show a compact choice list. It should not dump raw prompts, mounted-dataset instructions, or artifact JSON into the main conversation.

Judge for:
Is "last run" disambiguated, are artifacts summarized cleanly, and does the TUI keep long results readable through scrolling/wrapping?

### TUI09: Signed-Out Interactive Auth Recovery

Typed messages:

```text
Show my remote datasets.
```

Setup:
The TUI is launched with no valid `research` session.

Intention:
The user is inside the interactive app and asks for remote data while signed out.

Correct outcome:
The TUI should explain sign-in in product terms, show exactly how to sign in, and keep the conversation usable after auth. It should avoid session-file internals and should not leave the user wondering whether to quit.

Judge for:
Is auth failure visually and verbally clear, does the UI show a simple next step, and does it preserve the user's original intent after sign-in if possible?

### TUI10: Long Output And Scroll Ergonomics

Typed messages:

```text
Make me a county-month economics dataset for testing a housing-cycle hypothesis from 2015 to 2025. Include FRED rates, Census population/income, Zillow home values and rents, BLS employment/unemployment/CPI, FHFA HPI, and NBER recession indicators. Validate source URLs, row counts, missingness, join keys, temporal coverage, and produce a data dictionary and manifest.
```

Intention:
The user provides a long, specific build request that may produce a long plan or run-start response.

Correct outcome:
The TUI should preserve the full user prompt, show progress without blank/stalled screens, and render the plan or block state in a scannable way. Long URLs and ids should not destroy layout.

Judge for:
Does wrapping remain readable, does the input composer handle long text, does the output avoid flooding the viewport, and are the next action/artifact expectations visible without excessive scrolling?
