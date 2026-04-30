# symphony case: econ housing cycle dataset build

## Product Use

A user asks for an economics dataset with all necessary data for a housing-cycle hypothesis.

## Why This Test

This captures the acceptance behavior for turning a broad dataset request into a concrete economics research environment plan with sources, validation, and artifacts.

## Actions Taken

The product checks existing datasets and creates a research environment with a concrete acquisition and validation plan for a county-month housing-cycle dataset.

## Assertions Made

- Existing datasets are listed first.
- A research environment is created.
- The environment prompt includes FRED, Census, Zillow, BLS, FHFA, and NBER.
- The prompt requires row counts, missingness checks, join-key validation, source URLs, temporal coverage, a data dictionary, and a manifest.
- Required source URLs are included.
- The response includes the environment build run id and dataset id.
