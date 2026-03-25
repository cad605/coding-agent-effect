# 03 Tool Contract

Depends on: 01, 02

## Goal

Define a stable, typed contract for agent tools so every tool has consistent inputs, outputs, errors, and execution metadata.

## Non-Goals

- Choosing the complete initial tool list
- Implementing advanced tool safety policies
- Rendering tool results in the CLI

## Why This Is Needed Now

`app/adapters/services/agent-executor-tools.ts` already defines tools with `Tool.make`, but the current design is still adapter-shaped. Before expanding the tool surface, the project needs a shared contract for how the rest of the agent reasons about tool execution.

## Current Baseline

- Existing tools are `readFile`, `writeFile`, and `bash`.
- Tool failures are all wrapped in `ToolkitError`.
- The current domain layer does not model tool call metadata as part of the agent contract.

## Proposed Changes

### Port Changes

- Introduce typed tool execution contracts in `app/ports` rather than relying on adapter-local shapes.
- Define standard fields for:
  - tool name
  - validated input
  - validated output
  - failure shape
  - execution metadata such as duration or truncation

### Domain Changes

- The domain service should reason about tools as structured capabilities, not opaque side effects.
- Tool results should be attachable to prompt state and streamed events.

### Adapter Changes

- Refactor `app/adapters/services/agent-executor-tools.ts` to implement the shared contract.
- Keep adapter-local details, such as `FileSystem` and `ChildProcessSpawner`, behind the contract.

## Data Contracts And Boundaries

- Standardize a result union, for example:
  - success with structured payload
  - failure with typed error
  - optional metadata for logging and streaming
- Require schema validation at the tool boundary.

## CLI And UX Implications

- A stable tool contract is a prerequisite for readable tool event output and better user-facing diagnostics.

## Validation Strategy

- Add tests that assert:
  - schema validation happens at tool boundaries
  - tool errors are normalized
  - tool metadata is available to downstream consumers
- Run `bun lint:check`.
