# 07 Patch Editing

Depends on: 03, 06

## Goal

Add a patch-based editing capability so the agent can make targeted code changes without rewriting entire files.

## Non-Goals

- Full source formatting strategy
- Multi-file transactional edits
- Human approval UX

## Why This Is Needed Now

`writeFile` alone is too blunt for a coding agent. A patch tool reduces churn, preserves unrelated edits more reliably, and makes the model's editing behavior more precise.

## Current Baseline

- File editing is limited to full-file writes through `writeFile`.
- The current tool surface does not distinguish between precise edits and full replacement.

## Proposed Changes

### Port Changes

- Add an `applyPatch` capability to the shared tool contract.
- Define explicit patch success and failure semantics.

### Domain Changes

- Prefer patch editing as the primary code-change mechanism when an existing file already exists.
- Keep `writeFile` available for new-file creation or complete replacement when justified.

### Adapter Changes

- Extend `app/adapters/services/agent-executor-tools.ts` with an `applyPatch` implementation.
- Decide whether patch application is:
  - a custom parser and applier, or
  - a shell-backed adapter wrapped in the same contract

## Data Contracts And Boundaries

- Patch requests should identify the target file and patch payload.
- Failures must distinguish parse errors from context mismatch and file-system errors.

## CLI And UX Implications

- Patch events should surface cleanly in streamed output so users can understand what changed.

## Validation Strategy

- Add tests for:
  - successful in-place updates
  - patch context mismatch
  - add-file behavior if supported
- Run `bun lint:check`.
