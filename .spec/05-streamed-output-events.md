# 05 Streamed Output Events

Depends on: 01, 02, 03, 04

## Goal

Define a typed event stream for agent runs so progress, tool activity, errors, and final completion can be consumed incrementally.

## Non-Goals

- CLI styling details
- Persistence of event logs
- Subagent-specific event schemas

## Why This Is Needed Now

The current `Agent` API only returns a single string. That blocks interactive UX, detailed debugging, and future nested execution. A streamed event model is the cleanest way to expose runtime progress without coupling the domain to terminal rendering.

## Current Baseline

- `app/ports/agent.ts` returns `Effect<string, AgentError, never>`.
- `app/adapters/cli.ts` displays only the final response.

## Proposed Changes

### Port Changes

- Change the public `Agent` contract to expose a stream or stream-like effect of typed events.
- Define an `AgentEvent` union with at least:
  - assistant text
  - tool start
  - tool output
  - tool failure
  - completion

### Domain Changes

- Update `app/domain/services/agent.ts` to map executor events into a stable public event model.
- Keep domain event types independent from terminal formatting.

### Adapter Changes

- Update `app/adapters/agent-executor.ts` to emit incremental events rather than buffering everything into one string.
- Update `app/adapters/cli.ts` to render the stream progressively.

## Data Contracts And Boundaries

- Each event should include a discriminant and typed payload.
- Tool-related events should carry tool name and normalized output.
- Completion should be an event, not a side channel.

## CLI And UX Implications

- The CLI can evolve from "wait, then print" to "stream progress as work happens."
- This spec is also the prerequisite for richer REPL behavior later.

## Validation Strategy

- Add tests for event ordering and event completeness.
- Add adapter tests that prove the CLI can consume the stream without depending on provider internals.
- Run `bun lint:check`.
