# Spec 02: Steering and Subagent Support

## Goal

Add two capabilities to the Agent service:

1. **Steering** -- queue messages while the model is working; the agent interrupts the
   current turn at a safe boundary and injects them into the next turn.
2. **Subagents** -- spawn independent agent loops with their own conversation history,
   using `executor.fork()`.

## Prerequisites

- Spec 01 (executor Chat refactor) must be complete. The executor port exposes
  `streamTurn`, `fork`, and `exportJson`, and the domain `TurnEvent` union includes
  `TextEnd` and `ReasoningEnd` boundary markers.

## Constraints

- The Agent port (`app/ports/agent.ts`) must not import from `effect/unstable/ai`.
- Steering must not corrupt conversation history. Chat's `acquireUseRelease` in the
  adapter handles partial history commits when `Stream.takeUntil` fires.
- Single-shot `-p` mode must keep working (no steering in that path).
- Run `bun lint:check` after all changes.

---

## 1. Add `steer` to the Agent port

**File:** `app/ports/agent.ts`

```typescript
import { type Effect, type Scope, ServiceMap, type Stream } from "effect";

import type { AgentError } from "../domain/errors/agent.ts";
import type { AgentRunInput } from "../domain/models/agent-run.ts";
import type { Output } from "../domain/models/output.ts";

export interface AgentShape {
  send(
    input: AgentRunInput,
  ): Effect.Effect<Stream.Stream<Output, AgentError>, never, Scope.Scope>;

  /**
   * Queue a message to steer the agent. Resolves when the message is consumed
   * by the next turn. Interrupting the returned effect withdraws the message.
   */
  steer(message: string): Effect.Effect<void>;
}

export class Agent extends ServiceMap.Service<Agent, AgentShape>()(
  "app/ports/Agent",
) {}
```

---

## 2. Implement steering in the Agent service

**File:** `app/application/services/agent.ts`

### Pending messages data structure

```typescript
const pendingMessages = new Set<{
  readonly message: string;
  readonly resume: (effect: Effect.Effect<void>) => void;
}>();
```

### `steer` implementation

Uses `Effect.callback` so the effect resolves when the message is consumed. Interrupting
the effect removes the message from the set (withdrawal):

```typescript
const steer = (message: string): Effect.Effect<void> =>
  Effect.callback((resume) => {
    const entry = { message, resume };
    pendingMessages.add(entry);
    return Effect.sync(() => pendingMessages.delete(entry));
  });
```

### Modified agent loop

The core loop changes:

1. **Before each turn**, drain pending messages into the user message:

```typescript
let userMessage: string | null = turns === 0 ? input.prompt : null;
if (pendingMessages.size > 0) {
  const steered = Array.from(pendingMessages, ({ message, resume }) => {
    resume(Effect.void);
    return message;
  });
  pendingMessages.clear();
  const combined = [userMessage, ...steered].filter(Boolean).join("\n");
  userMessage = combined || null;
}
```

2. **During streaming**, use `Stream.takeUntil` to check for pending messages at
   safe boundaries:

```typescript
yield * executor.streamTurn({
  userMessage,
  systemPrompt: turns === 0 ? (input.system ?? DEFAULT_SYSTEM_PROMPT) : null,
}).pipe(
  Stream.takeUntil((event) =>
    (event._tag === "TextEnd" || event._tag === "ReasoningEnd")
    && pendingMessages.size > 0
  ),
  Stream.runForEach((event) => {
    // ... existing TurnEvent -> Output mapping
  }),
);
```

3. **Loop continuation logic** stays the same: if `!hadToolCall && pendingMessages.size === 0`,
   emit completion; otherwise increment turns and continue.

When `Stream.takeUntil` fires, the executor adapter's Chat instance commits partial
response parts to history via its `acquireUseRelease` release handler. The next
`streamTurn` call picks up from the updated history.

---

## 3. Subagent support

### New output types

**File:** `app/domain/models/output.ts`

Add these to the existing `Output` union:

```typescript
export class SubagentStart
  extends Schema.TaggedClass("SubagentStart")("SubagentStart", {
    id: Schema.Number,
    prompt: Schema.String,
  })
{}

export class SubagentComplete
  extends Schema.TaggedClass("SubagentComplete")("SubagentComplete", {
    id: Schema.Number,
    summary: Schema.String,
  })
{}

export class SubagentPart
  extends Schema.TaggedClass("SubagentPart")("SubagentPart", {
    id: Schema.Number,
    part: Schema.Union([
      AgentTextDelta,
      AgentToolCallStart,
      AgentToolResult,
      AgentUsageReport,
    ]),
  })
{}
```

Update the `Output` type union and `Schema.Union` to include these three.

### Output buffering

In `app/application/services/agent.ts`, add output buffering so subagent output doesn't
interleave with the main agent:

```typescript
const outputBuffer = new Map<number, Array<Output>>();
let currentOutputAgent: number | null = null;
let agentCounter = 0;

function maybeSend(options: {
  readonly agentId: number;
  readonly part: Output;
  readonly acquire?: boolean;
  readonly release?: boolean;
}) {
  if (currentOutputAgent === null || currentOutputAgent === options.agentId) {
    Queue.offerUnsafe(output, options.part);
    if (options.acquire) currentOutputAgent = options.agentId;
    if (options.release) {
      currentOutputAgent = null;
      // Flush any buffered output from other agents
      for (const [id, buffered] of outputBuffer) {
        outputBuffer.delete(id);
        Queue.offerAllUnsafe(output, buffered);
        break;
      }
    }
    return;
  }
  // Buffer output for non-current agents
  let buffer = outputBuffer.get(options.agentId);
  if (!buffer) {
    buffer = [];
    outputBuffer.set(options.agentId, buffer);
  }
  buffer.push(options.part);
}
```

### Spawn function

Extract the agent loop into a `spawn()` function that accepts an agentId and executor:

```typescript
const spawn = Effect.fnUntraced(function*(opts: {
  readonly agentId: number;
  readonly executor: AgentExecutorShape;
  readonly prompt: string;
  readonly system?: string | null;
}) {
  // ... the multi-turn loop, using opts.executor instead of the shared executor
  // ... uses maybeSend() instead of direct Queue.offer()
});
```

### Subagent spawning

```typescript
const spawnSubagent = Effect.fnUntraced(function*(prompt: string) {
  const id = agentCounter++;
  const subExecutor = yield* executor.fork();

  maybeSend({
    agentId: mainAgentId,
    part: new SubagentStart({ id, prompt }),
    release: true,
  });

  // Run subagent loop, wrapping its output in SubagentPart
  yield* spawn({
    agentId: id,
    executor: subExecutor,
    prompt,
    system: DEFAULT_SYSTEM_PROMPT,
  });
});
```

The subagent runs with its own executor (forked, with independent Chat history inside
the adapter). Its output events are wrapped in `SubagentPart` and funneled through
`maybeSend()` for ordered delivery.

---

## 4. Wire `steer` in the Agent service export

```typescript
return Agent.of({ send, steer }) satisfies AgentShape;
```

---

## 5. Update CLI to handle new output types

**File:** `app/adapters/cli.ts`

Add cases for the new output types in the `Match.valueTags` call. For now, ignore them
in single-shot mode (they'll be displayed in interactive mode in spec 03):

```typescript
SubagentStart: () => Effect.void,
SubagentComplete: () => Effect.void,
SubagentPart: () => Effect.void,
```

---

## Acceptance criteria

1. `bun lint:check` passes.
2. Single-shot `-p` mode works as before (steering is not triggered).
3. The `Agent` port exposes `steer(message: string): Effect<void>`.
4. The `AgentExecutor` port's `fork()` is called when spawning subagents.
5. `pendingMessages` are drained at the start of each turn.
6. `Stream.takeUntil` on `TextEnd` / `ReasoningEnd` interrupts the stream when
   pending messages are present.
7. Output types `SubagentStart`, `SubagentComplete`, `SubagentPart` exist in the
   domain and are part of the `Output` union.
