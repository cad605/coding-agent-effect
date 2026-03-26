# Spec 01: Rewrite AgentExecutor Port and Adapter (Chat-based)

## Goal

Replace the current `MutableRef<Prompt>` + `LanguageModel.streamText` implementation in the
AgentExecutor adapter with the Effect AI `Chat` module, while keeping the port interface
free of any `effect/unstable/ai` library types. The Agent service continues to work with
pure domain types only.

## Prerequisites

None -- this is the foundational refactor that the other specs build on.

## Constraints

- The port (`app/ports/agent-executor.ts`) must **not** import from `effect/unstable/ai`.
- All types on the port interface must be domain types defined in `app/domain/`.
- The single-shot `-p` CLI mode must keep working (CodeCrafters compatibility).
- Run `bun lint:check` after all changes to verify no regressions.

---

## 1. Evolve domain TurnEvent types

**File:** `app/domain/models/agent-executor.ts`

Remove `TurnInput` (the port will accept plain strings instead). Add `TextEnd`,
`ReasoningDelta`, and `ReasoningEnd` to the `TurnEvent` union. These are steering
boundary markers needed by future specs, but they must exist now so the adapter can
emit them.

### Target state

```typescript
import { Schema } from "effect";

export class TextDelta extends Schema.TaggedClass("TextDelta")("TextDelta", {
  delta: Schema.String,
}) {}

export class TextEnd extends Schema.TaggedClass("TextEnd")("TextEnd", {}) {}

export class ReasoningDelta
  extends Schema.TaggedClass("ReasoningDelta")("ReasoningDelta", {
    delta: Schema.String,
  })
{}

export class ReasoningEnd
  extends Schema.TaggedClass("ReasoningEnd")("ReasoningEnd", {})
{}

export class ToolCallStart
  extends Schema.TaggedClass("ToolCallStart")("ToolCallStart", {
    toolName: Schema.String,
    toolCallId: Schema.String,
  })
{}

export class ToolResult extends Schema.TaggedClass("ToolResult")("ToolResult", {
  toolName: Schema.String,
  toolCallId: Schema.String,
  output: Schema.String,
  isFailure: Schema.Boolean,
}) {}

export class UsageReport
  extends Schema.TaggedClass("UsageReport")("UsageReport", {
    inputTokens: Schema.Number,
    outputTokens: Schema.Number,
  })
{}

export class TurnComplete
  extends Schema.TaggedClass("TurnComplete")("TurnComplete", {
    hadToolCall: Schema.Boolean,
    text: Schema.String,
  })
{}

export type TurnEvent =
  | TextDelta
  | TextEnd
  | ReasoningDelta
  | ReasoningEnd
  | ToolCallStart
  | ToolResult
  | UsageReport
  | TurnComplete;

export const TurnEvent = Schema.Union([
  TextDelta,
  TextEnd,
  ReasoningDelta,
  ReasoningEnd,
  ToolCallStart,
  ToolResult,
  UsageReport,
  TurnComplete,
]);
```

---

## 2. Redesign the AgentExecutor port

**File:** `app/ports/agent-executor.ts`

Replace the current single-method `executeTurn(TurnInput)` interface with a richer
session-like interface. **No imports from `effect/unstable/ai`.**

### Target state

```typescript
import { type Effect, ServiceMap, type Stream } from "effect";

import type { AgentExecutorError } from "../domain/errors/agent-executor.ts";
import type { TurnEvent } from "../domain/models/agent-executor.ts";

export interface AgentExecutorShape {
  streamTurn(options: {
    readonly userMessage?: string | null;
    readonly systemPrompt?: string | null;
  }): Stream.Stream<TurnEvent, AgentExecutorError>;

  fork(): Effect.Effect<AgentExecutorShape, AgentExecutorError>;

  readonly exportJson: Effect.Effect<string, AgentExecutorError>;
}

export class AgentExecutor
  extends ServiceMap.Service<AgentExecutor, AgentExecutorShape>()(
    "app/ports/AgentExecutor",
  )
{}
```

---

## 3. Rewrite the AgentExecutor adapter

**File:** `app/adapters/agent-executor.ts`

Replace the current `MutableRef<Prompt>` + `LanguageModel.streamText` implementation
with a `Chat`-based implementation. The adapter owns Chat instances internally and maps
`Response.StreamPart` to domain `TurnEvent` at the boundary.

### Implementation outline

```typescript
import { OpenRouterLanguageModel } from "@effect/ai-openrouter";
import { Effect, Layer, Ref, Stream } from "effect";
import { Chat, Prompt } from "effect/unstable/ai";

import {
  AgentExecutorError,
  ModelTurnFailed,
} from "../domain/errors/agent-executor.ts";
import {
  ReasoningDelta,
  ReasoningEnd,
  TextDelta,
  TextEnd,
  ToolCallStart,
  ToolResult,
  TurnComplete,
  type TurnEvent,
  UsageReport,
} from "../domain/models/agent-executor.ts";
import {
  AgentExecutor,
  type AgentExecutorShape,
} from "../ports/agent-executor.ts";
import {
  AgentExecutorTools,
  AgentExecutorToolsService,
} from "./services/agent-executor-tools.ts";
import { ProviderService } from "./services/provider.ts";

const makeImpl = Effect.gen(function*() {
  const toolkit = yield* AgentExecutorTools;
  const model = yield* OpenRouterLanguageModel.model(
    "anthropic/claude-haiku-4.5",
  );

  const createExecutor = (chat: Chat.Service): AgentExecutorShape => ({
    streamTurn: Effect.fn("agent-executor.streamTurn")(
      function*(options) {
        // Apply system prompt to chat history if provided
        if (options.systemPrompt) {
          yield* Ref.update(
            chat.history,
            Prompt.setSystem(options.systemPrompt),
          );
        }

        // Build user prompt
        const prompt = options.userMessage ?? [];

        let text = "";
        let hadToolCall = false;

        return chat.streamText({ prompt, toolkit }).pipe(
          Stream.flatMap((part) => {
            const events: Array<TurnEvent> = [];
            switch (part.type) {
              case "text-delta":
                text += part.delta;
                events.push(new TextDelta({ delta: part.delta }));
                break;
              case "text-end":
                events.push(new TextEnd());
                break;
              case "reasoning-delta":
                text += part.delta;
                events.push(new ReasoningDelta({ delta: part.delta }));
                break;
              case "reasoning-end":
                events.push(new ReasoningEnd());
                break;
              case "tool-call":
                hadToolCall = true;
                events.push(
                  new ToolCallStart({
                    toolName: part.name,
                    toolCallId: part.id,
                  }),
                );
                break;
              case "tool-result":
                events.push(
                  new ToolResult({
                    toolName: part.name,
                    toolCallId: part.id,
                    output: String(part.result),
                    isFailure: part.isFailure,
                  }),
                );
                break;
              case "finish":
                events.push(
                  new UsageReport({
                    inputTokens: part.usage.inputTokens.total ?? 0,
                    outputTokens: part.usage.outputTokens.total ?? 0,
                  }),
                );
                break;
            }
            return Stream.fromIterable(events);
          }),
          Stream.concat(
            Stream.suspend(() =>
              Stream.make(new TurnComplete({ hadToolCall, text }))
            ),
          ),
        );
      },
      Stream.unwrap,
      (stream) =>
        stream.pipe(
          Stream.provide(model),
          Stream.catch((cause) =>
            Stream.fail(
              new AgentExecutorError({
                reason: new ModelTurnFailed({ cause }),
              }),
            )
          ),
        ),
    ),

    fork: Effect.gen(function*() {
      const subChat = yield* Chat.empty;
      return createExecutor(subChat);
    }).pipe(
      Effect.mapError((cause) =>
        new AgentExecutorError({ reason: new ModelTurnFailed({ cause }) })
      ),
    ),

    exportJson: chat.exportJson.pipe(
      Effect.mapError((cause) =>
        new AgentExecutorError({ reason: new ModelTurnFailed({ cause }) })
      ),
    ),
  });

  const mainChat = yield* Chat.fromPrompt(Prompt.empty);
  return AgentExecutor.of(createExecutor(mainChat));
}).pipe(
  Effect.provide(AgentExecutorToolsService),
  Effect.provide(ProviderService),
);

export const AgentExecutorAdapter = Layer.effect(AgentExecutor, makeImpl);
```

### Key changes from current adapter

| Aspect             | Before                                                                     | After                                                         |
| ------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------- |
| History management | Manual `MutableRef<Prompt>` + `Prompt.concat` / `Prompt.fromResponseParts` | `Chat` handles internally via `acquireUseRelease`             |
| Stream source      | `LanguageModel.streamText` directly                                        | `chat.streamText()` (delegates to `LanguageModel.streamText`) |
| System prompt      | `MutableRef.update(history, Prompt.setSystem(...))`                        | `Ref.update(chat.history, Prompt.setSystem(...))`             |
| Session export     | Not available                                                              | `chat.exportJson`                                             |
| Forking            | Not available                                                              | `Chat.empty` creates independent instance                     |

---

## 4. Update Agent service to use new port interface

**File:** `app/application/services/agent.ts`

Update to call `executor.streamTurn()` instead of `executor.executeTurn()`. The
`TurnInput` import is removed; plain strings are passed via the options object.

### Changes

- Replace `executor.executeTurn(turnInput)` with `executor.streamTurn({ userMessage, systemPrompt })`
- Remove import of `TurnInput` (deleted from domain)
- The `TurnComplete` import and event handling stay the same
- The `Match.valueTags` mapping for TurnEvent -> Output must handle the new event types
  (`TextEnd`, `ReasoningDelta`, `ReasoningEnd`) by ignoring them (future specs will use them)

### Target agent loop (relevant section)

```typescript
const turnOptions = turns === 0
  ? {
    userMessage: input.prompt,
    systemPrompt: input.system ?? DEFAULT_SYSTEM_PROMPT,
  }
  : { userMessage: null, systemPrompt: null };

let turnComplete: TurnComplete | undefined;

yield * executor.streamTurn(turnOptions).pipe(
  Stream.runForEach((event) => {
    if (event._tag === "TurnComplete") {
      turnComplete = event;
      return Effect.void;
    }

    // Ignore boundary markers for now (used by steering in spec 02)
    if (
      event._tag === "TextEnd" || event._tag === "ReasoningEnd"
      || event._tag === "ReasoningDelta"
    ) {
      return Effect.void;
    }

    const output: Output = Match.valueTags(event, {
      TextDelta: (e) => new AgentTextDelta({ delta: e.delta }),
      ToolCallStart: (e) =>
        new AgentToolCallStart({
          toolName: e.toolName,
          toolCallId: e.toolCallId,
        }),
      ToolResult: (e) =>
        new AgentToolResult({
          toolName: e.toolName,
          toolCallId: e.toolCallId,
          output: e.output,
          isFailure: e.isFailure,
        }),
      UsageReport: (e) =>
        new AgentUsageReport({
          inputTokens: e.inputTokens,
          outputTokens: e.outputTokens,
        }),
    });

    Queue.offer(queue, output);
    return Effect.void;
  }),
  // ... error handling stays the same
);
```

---

## 5. Verify wiring

**File:** `app/main.ts`

No changes expected -- `AgentExecutorAdapter` is still exported from the same path and
`Layer.provideMerge(AgentExecutorAdapter)` continues to work.

---

## Acceptance criteria

1. `bun lint:check` passes with no new errors.
2. Running `bun run app/main.ts -- -p "What is 2+2?"` produces the same behavior as before
   (single-shot mode, final answer printed to stdout).
3. The port file (`app/ports/agent-executor.ts`) has zero imports from `effect/unstable/ai`.
4. `TurnInput` no longer exists in the codebase.
5. The adapter internally uses `Chat.fromPrompt` / `chat.streamText` / `chat.exportJson`.
