# 01 Agent Runtime Loop

Depends on: none

## Goal

Define the core turn loop that lets the agent receive a prompt, call tools, incorporate results, and continue until the task is explicitly finished.

## Non-Goals

- Provider-specific model wiring
- Advanced tools like subagents, web search, or semantic search
- Persisting sessions across process restarts

## Why This Is Needed Now

The current executor in `app/adapters/agent-executor.ts` loops on `session.generateText()` until no tool calls remain and then returns a final string. That is enough for simple tool use, but it does not define a first-class runtime contract for task progress, completion semantics, or future event streaming.

## Current Baseline

- `app/ports/agent.ts` exposes `send({ prompt }) -> Effect<string, AgentError, never>`.
- `app/ports/agent-executor.ts` exposes `generateResponse({ prompt }) -> Effect<string, AgentExecutorError, never>`.
- `app/domain/services/agent.ts` forwards directly to the executor.

## Proposed Changes

### Port Changes

- Evolve `app/ports/agent.ts` from a single final string response to a session-oriented API.
- Replace `generateResponse` in `app/ports/agent-executor.ts` with a turn-loop contract such as:
  - start a run from a prompt and system context
  - execute model turns until completion
  - emit structured intermediate events

### Domain Changes

- Move loop orchestration into the domain service boundary instead of leaving it implicit inside one adapter method.
- Make the domain service responsible for:
  - assembling prompt state
  - invoking the model turn
  - forwarding tool results into the next turn
  - observing explicit task completion

### Adapter Changes

- Refactor `app/adapters/agent-executor.ts` so it implements a reusable runtime loop instead of returning only terminal text.
- Keep provider-specific `Chat` usage behind the executor boundary.

## Data Contracts And Boundaries

- Introduce a typed run input, for example `AgentRunInput`, instead of raw prompt-only input.
- Introduce a typed run result and intermediate event stream that later specs can build on.
- Keep the executor responsible for model/tool orchestration, not CLI formatting.

## CLI And UX Implications

- No immediate CLI UX change is required, but the runtime loop must support both one-shot commands and future interactive sessions.

## Validation Strategy

- Add unit tests for:
  - loop continuation after tool results
  - loop termination on explicit completion
  - loop failure propagation
- Run `bun lint:check`.
