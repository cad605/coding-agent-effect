# 06 Core Local Tools

Depends on: 02, 03, 04, 05

## Goal

Expand the minimal local toolset into the smallest useful coding-agent toolkit for repository work.

## Non-Goals

- Web access
- Semantic search
- Subagents

## Why This Is Needed Now

The current toolkit in `app/adapters/services/agent-executor-tools.ts` only includes `readFile`, `writeFile`, and `bash`. That is enough for experiments, but not enough for safe and efficient coding tasks inside a real repository.

## Current Baseline

- `readFile`
- `writeFile`
- `bash`

## Proposed Changes

### Port Changes

- Define the required initial tool set in the shared tool contract.
- Make tool capabilities discoverable to the runtime in a stable way.

### Domain Changes

- Treat these tools as the baseline capabilities expected by the core runtime.
- Keep higher-risk or optional tools out of the baseline until later specs.

### Adapter Changes

- Extend `app/adapters/services/agent-executor-tools.ts` with:
  - `ls`
  - `glob`
  - `rg`
  - improved `bash`
- Preserve `readFile` and `writeFile` as the foundational file tools.

## Data Contracts And Boundaries

- Tool inputs must remain typed and validated.
- Shell execution should include explicit timeout, stderr handling, and output truncation rules.
- Search and listing tools should return structured results where possible, not only raw text blobs.

## CLI And UX Implications

- Better local tools improve answer quality and reduce the need for destructive shell usage.
- Tool event streaming should make these capabilities observable to the user.

## Validation Strategy

- Add tool-specific tests for file listing, ripgrep invocation, and shell timeout behavior.
- Verify failures are normalized through the shared tool contract.
- Run `bun lint:check`.
