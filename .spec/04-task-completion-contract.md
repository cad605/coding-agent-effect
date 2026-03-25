# 04 Task Completion Contract

Depends on: 01, 02, 03

## Goal

Require explicit completion semantics so the runtime knows when the agent has actually finished the task.

## Non-Goals

- Defining human approval flows
- Persisting final summaries
- Optimizing model prompts

## Why This Is Needed Now

The current loop stops when no tool calls remain. That is not the same as task completion. A useful coding agent needs a first-class completion signal so it can distinguish between "the model stopped calling tools" and "the requested work is done."

## Current Baseline

- `app/ports/agent.ts` only returns a final string.
- `app/adapters/agent-executor.ts` returns when the model produces text without more tool calls.

## Proposed Changes

### Port Changes

- Introduce a typed completion result in `app/ports/agent.ts` and `app/ports/agent-executor.ts`.
- Add a completion signal that can carry a concise final summary and optional structured outcome data.

### Domain Changes

- The domain runtime loop should terminate only when it receives the explicit completion signal.
- A plain assistant text response should not automatically end the run unless the spec for the current interaction mode allows it.

### Adapter Changes

- Add a dedicated completion capability in the executor/tool layer rather than inferring completion from empty tool calls.
- Ensure completion flows through the same typed event path as other runtime events.

## Data Contracts And Boundaries

- Define a completion payload with:
  - summary
  - optional status
  - optional machine-readable result for future automation
- Keep completion transport-independent so the same contract works for CLI and tests.

## CLI And UX Implications

- The CLI will eventually be able to show a distinct "task complete" section instead of treating the last text chunk as the only answer.

## Validation Strategy

- Add tests that prove:
  - the loop does not stop early on plain text
  - the loop stops when completion is signaled
  - the final summary reaches the caller
- Run `bun lint:check`.
