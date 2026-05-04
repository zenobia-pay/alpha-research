# last run results select the latest completed run and explain newer active runs

## Product Use

A user asks for the last run results while a newer run is still active.

## Why This Test

This protects run lifecycle clarity. Completed results should not be confused with newer active work that has no final output yet.

## Actions Taken

Tracked runs include completed and active records; the fake client returns results for the completed run.

## Assertions Made

The response selects the latest completed run, explains the newer active run separately, and includes result artifacts.
