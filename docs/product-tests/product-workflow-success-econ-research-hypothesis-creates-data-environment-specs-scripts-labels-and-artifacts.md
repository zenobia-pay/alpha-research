# product workflow success: econ research hypothesis creates data environment, specs, scripts, labels, and artifacts

## Product Use

A user asks for an economics dataset with all necessary data for a housing-cycle hypothesis, then asks to see results and artifacts.

## Actions Taken

The product lists existing datasets, creates a research environment with an acquisition plan, waits for the environment build, creates a structured research spec, runs transformation, runs labeling, runs hypothesis analysis, waits at each stage, and retrieves final artifacts.

## Assertions Made

- Existing datasets are checked first.
- A research environment is created for housing-cycle economics.
- The required public source catalog is represented.
- The acquisition prompt includes source URLs, row counts, missingness, join keys, and reproducible validation.
- The research spec includes subset, shaping, labeling, and artifact requirements.
- Transformation, labeling, and hypothesis runs are started.
- Each async stage is waited on.
- Final results include table, chart, and markdown artifacts.
