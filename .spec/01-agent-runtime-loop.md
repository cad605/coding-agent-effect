# 01 Agent Runtime Loop

Depends on: none

## Goal

Define the core turn loop that lets the agent receive a prompt, call tools, incorporate results, and continue until the task is explicitly finished.

## Non-Goals

- Provider-specific model wiring
- Advanced tools like subagents, web search, or semantic search
- Persisting sessions across process restarts

## Why This Is Needed Now

The runtime loop now has a first-class contract, but the current implementation only partially matches the intended architecture. This spec should capture the required changes so later work converges on the intended boundaries instead of treating the current implementation as final.

## Current Baseline

- `app/ports/agent.ts` exposes `send(input) -> Effect<Stream<AgentEvent, AgentError>, AgentError, never>`.
- `app/ports/agent-executor.ts` exposes `executeTurn({ run }) -> Effect<AgentExecutorTurnResult, AgentExecutorError, never>`.
- `app/application/services/agent.ts` owns multi-turn orchestration, including prompt assembly, continuation after tool activity, turn budget enforcement, and explicit completion handling.
- `app/adapters/agent-executor.ts` owns provider-specific model and tool execution for a single turn.

## Current Gaps

### Public Run Contract

- `app/ports/agent.ts` now exposes a typed run API, but it is still effectively one-shot.
- `AgentRunInput` only carries `prompt` and optional `system`, so callers cannot resume or extend an existing run through the public port.
- The runtime should evolve toward a session-oriented API that can support future interactive flows without forcing callers to reconstruct state indirectly.

### Runtime Ownership

- `app/application/services/agent.ts` currently owns the multi-turn loop.
- That orchestration is no longer hidden in the adapter, which is progress, but the runtime policy should live behind a true domain service boundary rather than remaining application-only orchestration.
- The domain/runtime boundary should own:
  - prompt-state assembly
  - turn iteration
  - forwarding tool results into subsequent turns
  - completion detection
  - turn-budget enforcement

### Executor Boundary

- `app/adapters/agent-executor.ts` correctly owns provider-specific prompt translation, model wiring, and tool wiring for a single turn.
- However, explicit task completion is still interpreted inside the executor adapter via `completeTask`.
- Completion semantics should be observed at the runtime/domain boundary, with the executor limited to returning turn data and structured events from provider/tool execution.

## Data Contracts And Boundaries

- Keep `AgentRunInput` as a typed public entrypoint, but expand the public contract so a run can be resumed or continued without re-encoding prior state through raw prompts.
- Keep `AgentRunState` as the internal accumulated conversation state passed from the runtime layer into the executor.
- Keep `AgentExecutorTurnResult` as the single-turn return type carrying:
  - runtime messages to append into the run state
  - structured events emitted during the turn
- Treat the event stream, including explicit `Completion`, as the primary public run outcome unless a later spec introduces a separate aggregate run result.
- Keep the executor responsible for model and tool orchestration, not CLI formatting or run-level completion policy.

## Required Changes

### Port Changes

- Evolve `app/ports/agent.ts` from a one-shot run entrypoint into a session-oriented contract.
- Extend the public run API so callers can start a run and continue an existing run without rebuilding conversation state externally.
- Preserve typed inputs and typed events as the public interface.

### Domain Changes

- Move runtime-loop ownership behind a true domain/runtime service boundary instead of leaving it solely in `app/application/services/agent.ts`.
- Make that boundary responsible for:
  - assembling prompt state
  - invoking the executor for one turn
  - forwarding returned runtime messages into the next turn
  - observing explicit task completion
  - enforcing turn-budget and terminal failure behavior

### Adapter Changes

- Keep `app/adapters/agent-executor.ts` focused on reusable single-turn execution and provider-specific model/tool wiring.
- Keep provider-specific model usage behind the executor boundary.
- Remove run-level completion ownership from the executor adapter so the runtime/domain service, not infrastructure, decides when the overall task is complete.
- Keep CLI formatting in `app/adapters/cli.ts`.

## CLI And UX Implications

- No immediate CLI UX change is required.
- The current CLI can remain a one-shot command while the underlying port evolves to support longer-lived or resumable runs.
- Future interactive-session UX should build on the same public runtime contract rather than introducing a separate orchestration path.

## Validation Strategy

- Run `bun lint:check`.
