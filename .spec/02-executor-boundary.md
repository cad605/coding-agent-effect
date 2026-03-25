# 02 Executor Boundary

Depends on: 01

## Goal

Specify a strict execution boundary that isolates model orchestration from side effects such as file access, patch application, shell execution, and future delegation.

## Non-Goals

- Defining the final tool catalog
- CLI rendering decisions
- Persistence design

## Why This Is Needed Now

The current executor adapter in `app/adapters/agent-executor.ts` mixes model invocation and tool-enabled chat execution in one method. As the agent grows, this will make it harder to add retries, approvals, streaming, or alternative execution strategies without entangling unrelated concerns.

## Current Baseline

- `app/ports/agent-executor.ts` only exposes `generateResponse`.
- `app/adapters/agent-executor.ts` directly creates the model session and passes the toolkit into `generateText`.
- `app/domain/services/agent.ts` treats the executor as a black box that returns a string.

## Proposed Changes

### Port Changes

- Redefine `app/ports/agent-executor.ts` around execution responsibilities rather than final text generation.
- Split the boundary into operations such as:
  - model turn execution
  - tool execution
  - run lifecycle management

### Domain Changes

- Keep agent coordination in `app/domain/services/agent.ts`.
- Ensure the domain depends on executor capabilities through typed interfaces rather than concrete chat APIs.

### Adapter Changes

- Make `app/adapters/agent-executor.ts` the only adapter allowed to bridge:
  - the chosen model provider
  - the tool runtime
  - any sandbox or script execution implementation
- Keep file system and shell details in dedicated services such as `app/adapters/services/agent-executor-tools.ts`.

## Data Contracts And Boundaries

- Define a typed executor input that carries prompt state, system instructions, and prior tool outcomes.
- Define typed executor outputs for:
  - assistant text
  - tool requests
  - completion signals
  - recoverable failures
- Errors crossing the port should remain `Schema`-backed and adapter-agnostic.

## CLI And UX Implications

- The CLI should continue to depend on `Agent`, never directly on `AgentExecutor`.
- This separation will make it possible to change execution behavior without changing command handling.

## Validation Strategy

- Add focused tests around executor responsibilities and boundaries.
- Verify that domain tests can run against a fake executor implementation.
- Run `bun lint:check`.
