# 13 Subagent Model Isolation

Depends on: 09, 12

## Goal

Allow subagents to run with a distinct model configuration from the parent agent.

## Non-Goals

- Automatic cost optimization
- Multi-provider ensembles
- User-facing billing controls

## Why This Is Needed Now

Once subagents exist, the project needs a way to keep delegated work cheap, fast, or specialized without coupling that policy to the parent run.

## Current Baseline

- There is no subagent support yet.
- The current model configuration is hard-coded in the executor adapter.

## Proposed Changes

### Port Changes

- Extend the provider abstraction to support a secondary model profile for delegated work.
- Keep model-selection policy out of the public `Agent` contract unless the caller explicitly opts in.

### Domain Changes

- Parent runs should request subagent execution through a dedicated policy that can choose a child model profile.
- The default policy should remain deterministic and easy to reason about.

### Adapter Changes

- Provider adapters should expose enough configuration to instantiate:
  - the primary model
  - the subagent model
- CLI configuration may eventually expose overrides, but that is not required in the first implementation.

## Data Contracts And Boundaries

- Define a model-profile concept that can be attached to a run without leaking provider-specific details through the whole system.

## CLI And UX Implications

- No required CLI change in the first pass, but event output should make it possible to label child runs consistently if different model profiles are later surfaced.

## Validation Strategy

- Add tests for:
  - parent and child using different model profiles
  - fallback to a shared profile when no override is configured
- Run `bun lint:check`.
