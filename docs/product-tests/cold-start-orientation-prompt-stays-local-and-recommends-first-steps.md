# cold-start orientation prompt stays local and recommends first steps

## Product Use

A new user asks what to do first before choosing any dataset or run.

## Why This Test

This protects onboarding from becoming a backend planning call. The product should orient the user with practical next steps that can be understood before any remote work starts.

## Actions Taken

The agent answers the cold-start prompt with a fake remote client that would fail if called.

## Assertions Made

The response stays local, suggests listing datasets or providing a file/source, and avoids run ids, dashboard links, lifecycle jargon, and tool chatter.
