# 08 Project Instructions

Depends on: 01, 05, 06

## Goal

Load stable repository-specific instructions into the runtime so the agent can follow local conventions without repeating them in every prompt.

## Non-Goals

- Long-term user memory across workspaces
- Semantic indexing of documentation
- Dynamic policy updates during a run

## Why This Is Needed Now

This repository already relies on `AGENTS.md` for durable workspace guidance. The agent should consume that guidance as part of its normal runtime instead of depending on the caller to restate it.

## Current Baseline

- `AGENTS.md` exists at the repository root.
- The current runtime does not inject repository instructions into the prompt path.

## Proposed Changes

### Port Changes

- Extend the agent run input to carry resolved system instructions separately from the user prompt.

### Domain Changes

- Add instruction loading to the domain runtime setup.
- Merge built-in system guidance with project instructions in a deterministic order.

### Adapter Changes

- Add a small adapter or helper that reads `AGENTS.md` from the working directory.
- Keep file reading behind the same file-system abstractions already used by the tool layer where possible.

## Data Contracts And Boundaries

- Model instructions should be represented separately from user messages.
- Missing `AGENTS.md` should be a valid no-op, not an error.

## CLI And UX Implications

- The CLI does not need a new flag for the default behavior.
- Future CLI modes may add an override or disable switch, but that is out of scope for this spec.

## Validation Strategy

- Add tests covering:
  - repository instructions found and injected
  - missing file behavior
  - deterministic merge order with built-in system instructions
- Run `bun lint:check`.
