# vague housing risk request asks scope before costly work

## Product Use

A user asks whether the housing market is in trouble without specifying geography, outcome, time range, or depth of analysis.

## Why This Test

This protects the research-designer identity. A vague research question should slow the product down before it spends time or money. The agent should turn ambiguity into a small scoping choice instead of launching a broad public-data build or analysis run.

## Actions Taken

The agent receives a broad housing-risk prompt. The fake remote client throws if called, so the test proves the response is a clarification/design step rather than an accidental remote workflow.

## Assertions Made

- The answer asks whether the user means the U.S. housing market.
- The answer distinguishes a quick current-state read from a deeper risk analysis.
- The answer names concrete operational dimensions such as affordability, mortgage rates, prices, inventory, delinquencies, employment, and regional differences.
- No run, queue, or dashboard language appears.
- No remote tool planning occurs before scope is chosen.
