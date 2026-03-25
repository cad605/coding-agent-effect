# 11 CLI Interaction Model

Depends on: 05, 08, 09, 10

## Goal

Specify the command-line interaction model for both one-shot usage and an interactive coding session.

## Non-Goals

- Terminal styling details beyond required information flow
- GUI or editor integrations
- Remote execution protocols

## Why This Is Needed Now

The current CLI in `app/adapters/cli.ts` is a single command that accepts one prompt and prints one final response. Once the runtime supports streaming, retries, and project instructions, the CLI needs a corresponding interaction model.

## Current Baseline

- One `assistant` command
- One `--prompt` flag
- Final response displayed only after execution completes

## Proposed Changes

### Port Changes

- No direct CLI concerns should leak into `app/ports/agent.ts`.
- The CLI should consume the public event stream and final completion event through the `Agent` service.

### Domain Changes

- Keep all user-interaction policy out of the domain service.
- The domain should only expose run inputs and streamed events.

### Adapter Changes

- Evolve `app/adapters/cli.ts` to support:
  - one-shot prompt mode
  - interactive REPL mode
  - provider and model selection flags once provider abstraction exists
  - progressive event rendering

## Data Contracts And Boundaries

- Define how CLI commands convert command-line flags into typed run inputs.
- Keep output rendering separate from event generation so it can be tested independently.

## CLI And UX Implications

- Users should be able to:
  - run a single request and exit
  - enter a prompt loop for iterative work
  - observe tool and retry progress in real time

## Validation Strategy

- Add CLI adapter tests for one-shot mode and REPL behavior.
- Verify the CLI can consume the event stream without direct knowledge of tool internals.
- Run `bun lint:check`.
