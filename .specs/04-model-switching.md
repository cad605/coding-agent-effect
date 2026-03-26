# Spec 04: Model Switching

## Goal

Make the LLM model configurable at startup and switchable at runtime during interactive
sessions. Subagents use a separate (typically cheaper) model. All model resolution
happens inside the executor adapter -- the Agent service is unaware of models.

## Prerequisites

- Spec 01 (executor Chat refactor) must be complete.
- Spec 03 (interactive mode) should be complete for the `/model` slash command, though
  this spec can be partially built without it.

## Constraints

- The Agent port and Agent service must **not** reference model names or model layers.
- Model resolution is an adapter concern -- it lives in `app/adapters/`.
- Default model remains `anthropic/claude-haiku-4.5` for backward compatibility.
- Run `bun lint:check` after all changes.

---

## 1. ModelConfig reference service

**File:** `app/domain/models/model-config.ts` (new)

A `ServiceMap.Reference` that holds the current model name. The CLI sets it; the
executor adapter reads it.

```typescript
import { ServiceMap } from "effect";

export class ModelConfig extends ServiceMap.Reference<string>(
  "app/domain/ModelConfig",
  { defaultValue: () => "anthropic/claude-haiku-4.5" },
) {}
```

---

## 2. SubagentModel service

**File:** `app/adapters/services/subagent-model.ts` (new)

A service that provides the model layer for subagent executors. This is an adapter
concern, not a domain concept.

```typescript
import { type Layer, ServiceMap } from "effect";
import type { LanguageModel } from "effect/unstable/ai";

export class SubagentModel extends ServiceMap.Service<
  SubagentModel,
  Layer.Layer<LanguageModel.LanguageModel>
>()(
  "app/adapters/SubagentModel",
) {}
```

The CLI wires this at startup based on the chosen main model. Typical default: when
main model is `anthropic/claude-sonnet-4`, subagent model is `anthropic/claude-haiku-4.5`.

---

## 3. Update the executor adapter to read ModelConfig

**File:** `app/adapters/agent-executor.ts`

Instead of hardcoding the model, resolve it from `ModelConfig` on each turn:

```typescript
import { ModelConfig } from "../domain/models/model-config.ts";

const makeImpl = Effect.gen(function*() {
  const toolkit = yield* AgentExecutorTools;
  const modelConfig = yield* ModelConfig;
  const subagentModel = yield* SubagentModel;

  // Resolve model layer dynamically based on current config value
  const resolveModel = () =>
    OpenRouterLanguageModel.model(modelConfig);

  const createExecutor = (chat: Chat.Service, useSubagentModel: boolean): AgentExecutorShape => ({
    streamTurn: Effect.fn("agent-executor.streamTurn")(
      function*(options) {
        // ... same mapping logic as spec 01
        const modelLayer = useSubagentModel
          ? subagentModel
          : yield* resolveModel();

        return chat.streamText({ prompt, toolkit }).pipe(
          // ... mapping ...
          Stream.provide(modelLayer),
          // ... error handling ...
        );
      },
      Stream.unwrap,
      // ...
    ),

    fork: Effect.gen(function*() {
      const subChat = yield* Chat.empty;
      return createExecutor(subChat, true); // subagents use subagent model
    }).pipe(Effect.mapError(...)),

    exportJson: chat.exportJson.pipe(Effect.mapError(...)),
  });

  const mainChat = yield* Chat.fromPrompt(Prompt.empty);
  return AgentExecutor.of(createExecutor(mainChat, false));
});
```

### Alternative: `Layer.unwrap` pattern

If resolving the model dynamically per-turn is complex, use `Layer.unwrap` to create
the model layer from config at adapter construction time, and update it via Ref when
the model changes.

---

## 4. Add `--model` CLI flag

**File:** `app/adapters/cli.ts`

```typescript
const model = Flag.string("model").pipe(
  Flag.withAlias("m"),
  Flag.withDescription("The model to use (e.g. anthropic/claude-sonnet-4)."),
  Flag.optional,
);
```

Wire into command:

```typescript
Command.make(
  "assistant",
  { prompt, model },
  Effect.fn("cli.assistant")(
    function*({ prompt, model: modelOption }) {
      // If model flag provided, update ModelConfig
      if (Option.isSome(modelOption)) {
        yield* Ref.set(yield* ModelConfig, modelOption.value);
      }
      // ... rest of handler
    },
  ),
);
```

---

## 5. Add `/model` slash command

**File:** `app/adapters/cli.ts`

In the `handleSlashCommand` function:

```typescript
case "model":
  if (args.length > 0) {
    const newModel = args.join(" ");
    yield* Ref.set(yield* ModelConfig, newModel);
    yield* terminal.display(`[model switched to ${newModel}]\n`);
  } else {
    const current = yield* Ref.get(yield* ModelConfig);
    yield* terminal.display(`[current model: ${current}]\n`);
  }
  break;
```

---

## 6. Environment variable fallback

**File:** `app/main.ts` or `app/adapters/cli.ts`

Read `DEFAULT_MODEL` env var as a config fallback:

```typescript
const defaultModel = yield * Config.string("DEFAULT_MODEL").pipe(
  Config.withDefault("anthropic/claude-haiku-4.5"),
);
```

Use this as the initial value for `ModelConfig`.

### Configuration priority

1. `/model <name>` slash command (runtime, interactive only)
2. `--model` / `-m` CLI flag
3. `DEFAULT_MODEL` environment variable
4. Hardcoded fallback: `anthropic/claude-haiku-4.5`

---

## 7. Wire SubagentModel in main.ts

**File:** `app/main.ts`

```typescript
import { SubagentModel } from "./adapters/services/subagent-model.ts";

const SubagentModelLayer = SubagentModel.layer(
  OpenRouterLanguageModel.model("anthropic/claude-haiku-4.5"),
);

const AppLayer = AgentService.pipe(
  Layer.provideMerge(AgentExecutorAdapter),
  Layer.provideMerge(SubagentModelLayer),
  Layer.provideMerge(BunServices.layer),
);
```

---

## Acceptance criteria

1. `bun lint:check` passes.
2. `bun run app/main.ts -- -p "hello"` uses default model (`anthropic/claude-haiku-4.5`).
3. `bun run app/main.ts -- -p "hello" --model anthropic/claude-sonnet-4` uses the
   specified model.
4. `DEFAULT_MODEL=anthropic/claude-sonnet-4 bun run app/main.ts -- -p "hello"` uses the
   env var model.
5. In interactive mode, `/model anthropic/claude-sonnet-4` switches the model for
   subsequent turns.
6. `/model` (no arg) displays the current model name.
7. Subagents spawned via `executor.fork()` use the subagent model, not the main model.
8. The Agent service (`app/application/services/agent.ts`) has no model-related imports.
