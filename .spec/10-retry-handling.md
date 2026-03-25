# 10 Retry Handling

Depends on: 01, 02, 05, 09

## Goal

Define retry behavior for transient model and execution failures without hiding permanent failures or corrupting run state.

## Non-Goals

- Human approval of retries
- Circuit breakers across multiple runs
- Persistence of retry history

## Why This Is Needed Now

Once the runtime loop and provider abstraction exist, transient errors will become a normal operational case. Retry behavior should be specified centrally instead of being improvised inside adapters.

## Current Baseline

- The current implementation does not define structured retry behavior around model calls or tool execution.

## Proposed Changes

### Port Changes

- Add retry-aware error categories to the executor or provider boundary.
- Distinguish retryable failures from terminal failures.

### Domain Changes

- The runtime loop should own retry policy decisions for model turns.
- Tool retries should be opt-in and tool-specific rather than global by default.

### Adapter Changes

- Provider adapters should classify transport, timeout, and rate-limit failures.
- Executor adapters should surface retry metadata as events when relevant.

## Data Contracts And Boundaries

- Define retry metadata such as:
  - attempt number
  - delay
  - failure category
- Keep retry policy configuration separate from event rendering.

## CLI And UX Implications

- Streamed output should eventually show when the agent is retrying a transient failure instead of appearing stalled.

## Validation Strategy

- Add tests for:
  - retryable provider failures
  - non-retryable failures
  - maximum attempt behavior
- Run `bun lint:check`.
