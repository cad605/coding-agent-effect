# 09 Provider Abstraction

Depends on: 01, 02, 05

## Goal

Introduce a provider-agnostic model boundary so the runtime can switch model backends without rewriting agent logic.

## Non-Goals

- Multi-provider failover
- Provider-specific auth UX
- Model selection UI

## Why This Is Needed Now

`app/adapters/agent-executor.ts` is currently coupled to `OpenRouterLanguageModel.model("anthropic/claude-haiku-4.5")`. That is acceptable for bootstrapping, but it will block experimentation and make later features too adapter-specific.

## Current Baseline

- One provider is hard-coded inside the executor adapter.
- The rest of the system cannot swap models through a stable port.

## Proposed Changes

### Port Changes

- Add a model-provider port that exposes the operations the runtime actually needs.
- Keep provider details out of the `Agent` public contract.

### Domain Changes

- The domain runtime should depend on the provider port for model turns.
- Model configuration should be supplied through layers or configuration, not hard-coded in the domain.

### Adapter Changes

- Move OpenRouter-specific setup into a dedicated provider adapter.
- Keep `app/adapters/agent-executor.ts` focused on orchestration rather than provider construction.

## Data Contracts And Boundaries

- Define typed inputs for model turn execution, including:
  - prompt state
  - tools or tool descriptors
  - system instructions
- Normalize provider errors before they cross the boundary.

## CLI And UX Implications

- This spec enables future provider and model flags in the CLI without forcing the CLI to understand provider internals.

## Validation Strategy

- Add tests that run the domain against a fake provider implementation.
- Verify provider-specific setup remains isolated to adapters.
- Run `bun lint:check`.
