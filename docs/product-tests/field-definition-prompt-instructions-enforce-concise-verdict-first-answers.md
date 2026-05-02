# field-definition prompt instructions enforce concise verdict-first answers

## Product Use

When a user asks what a field means, the answer should be concise, verdict-first, and grounded in schema evidence.

## Why This Test

Field-definition questions are common before analysis. Long speculative explanations or incorrect derived-field definitions lead to bad research choices.

## Actions Taken

The harness exercises prompt instructions for a field-definition request.

## Assertions Made

The answer is concise, starts with the useful verdict, distinguishes stored fields from derived metrics, and avoids misleading quote-count logic.
