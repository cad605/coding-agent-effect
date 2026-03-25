# 16 Session Persistence

Depends on: 01, 04, 05, 11

## Goal

Specify how agent sessions can be persisted and optionally resumed across process restarts.

## Non-Goals

- Provider auth token storage
- Semantic index persistence
- User-wide memory mining

## Why This Is Needed Now

Session persistence is useful, but it should come after the runtime, completion contract, event model, and CLI interaction shape are stable. Otherwise the project risks persisting a moving target.

## Current Baseline

- The current implementation keeps no durable agent session state.
- Every CLI invocation starts from a fresh prompt with no resume path.

## Proposed Changes

### Port Changes

- Introduce a session store port for saving and loading run state.
- Keep persistence optional so the core runtime still works in memory.

### Domain Changes

- Define what state is resumable, such as:
  - user and assistant message history
  - pending completion state
  - run metadata
- Avoid persisting adapter-specific objects or live fibers.

### Adapter Changes

- Add a file-system-backed session store adapter as the first implementation.
- Update the CLI to support resuming or listing resumable sessions only after the storage contract exists.

## Data Contracts And Boundaries

- Persist normalized serializable data only.
- Version stored session records so later schema changes are manageable.
- Keep completion summaries and event snapshots separate from provider auth or search indexes.

## CLI And UX Implications

- Future CLI features may include:
  - resume latest session
  - resume by id
  - list saved sessions
- Those commands should remain optional and should not complicate the core one-shot path.

## Validation Strategy

- Add tests for:
  - save and load round trips
  - missing or incompatible session records
  - resume behavior after explicit completion
- Run `bun lint:check`.
