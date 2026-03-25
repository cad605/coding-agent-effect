# 12 Subagents

Depends on: 01, 02, 04, 05, 09, 11

## Goal

Add a delegation capability so the main agent can hand bounded subtasks to nested agent runs.

## Non-Goals

- Distributed execution across machines
- Automatic parallel planning for every task
- Persistent subagent transcript storage

## Why This Is Needed Now

Subagents are a major capability multiplier, but they only become manageable once the project already has a stable runtime loop, streamed events, explicit completion, and a CLI that can render nested work.

## Current Baseline

- The current runtime has no delegation or nested run concept.
- There is no event model for parent and child execution.

## Proposed Changes

### Port Changes

- Add a subagent execution capability to the runtime or tool contract.
- Define how a parent run requests a child run and how child output is surfaced back.

### Domain Changes

- The domain runtime should own:
  - subtask request validation
  - child-run lifecycle tracking
  - merging child outcomes into the parent run
- Parent and child runs should remain isolated except for explicit handoff data.

### Adapter Changes

- Extend the tool layer with a `delegate`-style capability.
- Update the CLI renderer to show nested execution clearly.

## Data Contracts And Boundaries

- Define a subagent input contract with:
  - task prompt
  - optional scoped instructions
  - optional model override hook for later use
- Child completion should flow back through the same event and completion channels as top-level runs.

## CLI And UX Implications

- The CLI should surface when a subagent starts, streams work, and completes.
- Nested output must remain readable without leaking CLI concerns into domain events.

## Validation Strategy

- Add tests for:
  - successful delegation
  - child failure propagation
  - parent continuation after child completion
- Run `bun lint:check`.
