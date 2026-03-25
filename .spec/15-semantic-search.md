# 15 Semantic Search

Depends on: 03, 06, 09, 14

## Goal

Add optional semantic code search for larger repositories where exact-match search is not enough.

## Non-Goals

- Replacing `rg` and path-based tools
- Long-term memory storage
- Automatic indexing of external web content

## Why This Is Needed Now

Semantic search becomes valuable only after the baseline local toolset is strong. It should be treated as an enhancement for code discovery, not a replacement for exact file and text operations.

## Current Baseline

- The repository has no semantic indexing or embedding-backed search path.
- Local discovery is limited to exact file and shell-based tooling.

## Proposed Changes

### Port Changes

- Add an optional semantic search capability behind its own port rather than mixing it into the core tool layer implicitly.

### Domain Changes

- The runtime should advertise semantic search only when the capability is configured.
- Semantic search results should complement, not replace, exact-match search and file reads.

### Adapter Changes

- Introduce adapters for:
  - code chunking
  - embedding generation
  - local index storage
  - semantic query execution
- Keep indexing lifecycle concerns out of the CLI.

## Data Contracts And Boundaries

- Define typed result entries with:
  - file path
  - snippet or chunk preview
  - relevance score
- Support both full re-index and incremental updates in the adapter design.

## CLI And UX Implications

- No mandatory CLI change is required beyond surfacing the tool if configured.
- Future flags may enable or disable semantic search explicitly.

## Validation Strategy

- Add tests for chunking, indexing, querying, and no-capability fallback behavior.
- Run `bun lint:check`.
