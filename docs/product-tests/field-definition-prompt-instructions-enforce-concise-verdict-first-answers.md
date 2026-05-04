# field-definition prompt instructions enforce concise verdict-first answers

## Product Use

A user asks what a field means and whether it can define virality.

## Why This Test

This protects system instructions for concept answers. The model should answer the definition before proposing work and keep the response concise.

## Actions Taken

The test captures backend instructions for a field-definition prompt.

## Assertions Made

The instructions require a verdict-first answer, schema-evidence clarity, explicit uncertainty, and no unsolicited composite formulas or analysis starts.
