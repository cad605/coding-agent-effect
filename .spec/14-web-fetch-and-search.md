# 14 Web Fetch And Search

Depends on: 03, 05, 09, 11

## Goal

Add opt-in web access tools that let the agent fetch documentation pages and perform web search without conflating those features with local repository search.

## Non-Goals

- Semantic code search
- Browser automation
- Generic MCP orchestration

## Why This Is Needed Now

Web access is useful for documentation lookup and external context, but it should remain a distinct capability from local repository tooling so the agent does not overreach or depend on external access for ordinary coding tasks.

## Current Baseline

- The current tool surface is local-only.
- There is no external search or URL fetch capability.

## Proposed Changes

### Port Changes

- Extend the tool contract with web-specific capabilities such as:
  - `fetchMarkdown`
  - `webSearch`

### Domain Changes

- Treat web tools as optional capabilities the runtime can advertise to the model.
- Do not make external web access a requirement for the core agent loop.

### Adapter Changes

- Add dedicated adapters for:
  - URL fetch plus markdown conversion
  - external web search provider integration
- Keep provider-specific web APIs out of the domain.

## Data Contracts And Boundaries

- Fetch results should normalize content into markdown or structured search results.
- Errors should distinguish unreachable URLs, provider failures, and content conversion problems.

## CLI And UX Implications

- Web tool activity should appear in streamed output so the user can tell when the agent left the local repository context.

## Validation Strategy

- Add tests for:
  - markdown fetch normalization
  - search result shaping
  - network failure normalization
- Run `bun lint:check`.
