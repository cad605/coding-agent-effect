# Spec 03: Interactive Mode

## Goal

Add an interactive REPL mode to the CLI alongside the existing single-shot `-p` mode.
When no `-p` flag is provided, the user enters a conversational loop with streaming
output display and slash command support.

## Prerequisites

- Spec 01 (executor Chat refactor) must be complete.
- Spec 02 (steering + subagents) must be complete -- the Agent port has `steer()` and
  output types include `SubagentStart`, `SubagentComplete`, `SubagentPart`.

## Constraints

- When `-p` is provided, behavior is identical to current single-shot mode (CodeCrafters).
- The interactive loop must display streaming text deltas as they arrive.
- Ctrl+C during model execution should gracefully exit (via `QuitError` from
  `Terminal.readLine`).
- Run `bun lint:check` after all changes.

---

## 1. Make the prompt flag optional

**File:** `app/adapters/cli.ts`

Change `Flag.string("prompt")` to `Flag.optional`:

```typescript
prompt: Flag.string("prompt").pipe(
  Flag.withAlias("p"),
  Flag.withDescription("The prompt to operate on."),
  Flag.optional,
),
```

The handler's `prompt` parameter becomes `Option<string>`.

---

## 2. Add ConversationMode reference

**File:** `app/domain/models/conversation-mode.ts` (new)

```typescript
import { Layer, ServiceMap } from "effect";

export class ConversationMode extends ServiceMap.Reference<boolean>(
  "app/domain/ConversationMode",
  { defaultValue: () => false },
) {
  static readonly layer = (enabled: boolean) =>
    Layer.succeed(ConversationMode, enabled);
}
```

This boolean distinguishes interactive (true) vs single-shot (false). The Agent service
uses it to decide whether a turn without tool calls means "completion" (interactive) vs
"exit" (single-shot).

---

## 3. Implement the interactive REPL

**File:** `app/adapters/cli.ts`

### Command handler structure

```typescript
import * as Option from "effect/Option";
import * as CliPrompt from "effect/unstable/cli/Prompt";

Effect.fn("cli.assistant")(
  function*({ prompt }: { prompt: Option.Option<string> }) {
    const agent = yield* Agent;
    const terminal = yield* Terminal.Terminal;

    if (Option.isSome(prompt)) {
      // Single-shot mode (existing behavior)
      yield* runSingleShot(agent, terminal, prompt.value);
      return;
    }

    // Interactive mode
    yield* runInteractive(agent, terminal);
  },
);
```

### Single-shot mode (extract existing logic)

```typescript
const runSingleShot = (
  agent: AgentShape,
  terminal: Terminal.Terminal,
  prompt: string,
) =>
  pipe(
    agent.send(new AgentRunInput({ prompt, system: null })),
    Stream.unwrap,
    Stream.runForEach((event: Output) =>
      Match.valueTags(event, {
        AgentTextDelta: () => Effect.void,
        AgentToolCallStart: () => Effect.void,
        AgentToolResult: () => Effect.void,
        AgentUsageReport: () => Effect.void,
        SubagentStart: () => Effect.void,
        SubagentComplete: () => Effect.void,
        SubagentPart: () => Effect.void,
        Completion: ({ summary }) => terminal.display(`${summary}\n`),
      })
    ),
  );
```

### Interactive mode

```typescript
const runInteractive = Effect.fn("cli.interactive")(function*(
  agent: AgentShape,
  terminal: Terminal.Terminal,
) {
  while (true) {
    const input = yield* CliPrompt.text({ message: ">" });

    // Handle slash commands
    if (input.startsWith("/")) {
      yield* handleSlashCommand(input, agent, terminal);
      continue;
    }

    // Send to agent and stream output
    yield* pipe(
      agent.send(new AgentRunInput({ prompt: input, system: null })),
      Stream.unwrap,
      Stream.runForEach((event: Output) =>
        Match.valueTags(event, {
          AgentTextDelta: ({ delta }) => terminal.display(delta),
          AgentToolCallStart: ({ toolName }) =>
            terminal.display(`\n[tool: ${toolName}]\n`),
          AgentToolResult: ({ toolName, output }) =>
            terminal.display(
              `[${toolName} result: ${output.slice(0, 100)}...]\n`,
            ),
          AgentUsageReport: () => Effect.void,
          SubagentStart: ({ id, prompt }) =>
            terminal.display(`\n[subagent ${id}: ${prompt.slice(0, 80)}...]\n`),
          SubagentComplete: ({ id, summary }) =>
            terminal.display(
              `[subagent ${id} done: ${summary.slice(0, 80)}...]\n`,
            ),
          SubagentPart: () => Effect.void,
          Completion: () => terminal.display("\n"),
        })
      ),
    );

    yield* terminal.display("\n");
  }
});
```

### Slash commands (initial set)

```typescript
const handleSlashCommand = Effect.fn("cli.slashCommand")(function*(
  input: string,
  agent: AgentShape,
  terminal: Terminal.Terminal,
) {
  const [command, ...args] = input.slice(1).split(" ");

  switch (command) {
    case "exit":
    case "quit":
      return yield* Effect.die("exit");
    case "steer":
      if (args.length > 0) {
        yield* agent.steer(args.join(" "));
        yield* terminal.display("[steering message queued]\n");
      }
      break;
    case "help":
      yield* terminal.display([
        "Available commands:",
        "  /exit      -- exit the session",
        "  /steer MSG -- queue a steering message",
        "  /help      -- show this help",
        "",
      ].join("\n"));
      break;
    default:
      yield* terminal.display(`Unknown command: /${command}\n`);
  }
});
```

Slash commands for `/model` and `/session` are stubs here -- they'll be implemented
in specs 04 and 05 respectively.

---

## 4. Wire ConversationMode

**File:** `app/main.ts`

The ConversationMode layer is provided based on whether `-p` was passed. This can be
done via `Command.provide` in the CLI adapter (see reference implementation pattern):

```typescript
Command.provide(({ prompt }) =>
  ConversationMode.layer(Option.isNone(prompt)),
),
```

**File:** `app/application/services/agent.ts`

Resolve `ConversationMode` and use it in the loop exit condition:

```typescript
const conversationMode = yield * ConversationMode;

// In the loop:
if (!turn.hadToolCall && pendingMessages.size === 0) {
  yield
    * Queue.offer(
      queue,
      new CompletionOutput({ summary: turn.text, status: "completed" }),
    );
  if (!conversationMode) return; // single-shot: exit after first completion
  // interactive: loop continues, waiting for next send()
}
```

---

## 5. Update main.ts layer composition

**File:** `app/main.ts`

Add `ConversationMode` to the layer stack. It doesn't need to be in `AppLayer` if
it's provided via `Command.provide` at the CLI level.

---

## Acceptance criteria

1. `bun lint:check` passes.
2. `bun run app/main.ts -- -p "What is 2+2?"` works identically to before (single-shot).
3. `bun run app/main.ts` (no `-p`) enters the interactive REPL.
4. In interactive mode:
   - User sees a `>` prompt.
   - Typing a message streams text deltas to the terminal in real-time.
   - Tool calls show brief `[tool: name]` indicators.
   - `/exit` exits the session.
   - `/steer MSG` queues a steering message.
   - `/help` shows available commands.
5. `ConversationMode` is `true` in interactive mode, `false` in single-shot mode.
