# golden: show remote datasets

## Product Use

A user asks to show remote datasets.

## Why This Test

This protects the simplest discovery action in the product. Users need a dependable way to see what datasets are available before starting work.

## Actions Taken

The product lists available datasets and reports the count.

## Assertions Made

- The product calls `list_remote_datasets`.
- The response says one remote dataset was found.
