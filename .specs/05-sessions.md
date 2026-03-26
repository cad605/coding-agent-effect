# Spec 05: Session Persistence

## Goal

Add the ability to save, load, and list conversation sessions. Sessions persist
the full conversation history so the user can resume where they left off. Session
storage is abstracted behind a port with a filesystem adapter.

## Prerequisites

- Spec 01 (executor Chat refactor) must be complete -- `executor.exportJson` is available.
- Spec 03 (interactive mode) should be complete for the `/session` slash commands.

## Constraints

- Session persistence is accessed through a port (`SessionStore`), not directly via
  the filesystem.
- The Agent service calls `executor.exportJson` to get the serialized state -- it does
  not know about Chat internals.
- The executor adapter must support initialization from a saved JSON string (session
  restore).
- Run `bun lint:check` after all changes.

---

## 1. Session domain models

**File:** `app/domain/models/session.ts` (new)

```typescript
import { Schema } from "effect";

export class SessionMetadata extends Schema.Class("SessionMetadata")({
  id: Schema.String,
  createdAt: Schema.DateTimeUtcFromString,
  lastAccessedAt: Schema.DateTimeUtcFromString,
  modelName: Schema.NullOr(Schema.String),
  label: Schema.NullOr(Schema.String),
}) {}

export class SessionData extends Schema.Class("SessionData")({
  metadata: SessionMetadata,
  chatHistory: Schema.String,
}) {}
```

`chatHistory` is the opaque JSON string from `executor.exportJson`. The Agent service
doesn't parse it -- it passes it through to `SessionStore.save()` and back to the
executor adapter on restore.

---

## 2. SessionStore port

**File:** `app/ports/session-store.ts` (new)

```typescript
import { type Effect, ServiceMap } from "effect";

import type { SessionData, SessionMetadata } from "../domain/models/session.ts";

export class SessionNotFound extends Schema.TaggedErrorClass<SessionNotFound>()(
  "SessionNotFound",
  { id: Schema.String },
) {}

export class SessionStoreError
  extends Schema.TaggedErrorClass<SessionStoreError>()(
    "SessionStoreError",
    { cause: Schema.Defect },
  )
{}

export interface SessionStoreShape {
  save(data: SessionData): Effect.Effect<void, SessionStoreError>;
  load(
    id: string,
  ): Effect.Effect<SessionData, SessionNotFound | SessionStoreError>;
  list(): Effect.Effect<Array<SessionMetadata>, SessionStoreError>;
  delete(id: string): Effect.Effect<void, SessionStoreError>;
}

export class SessionStore
  extends ServiceMap.Service<SessionStore, SessionStoreShape>()(
    "app/ports/SessionStore",
  )
{}
```

---

## 3. Filesystem session adapter

**File:** `app/adapters/services/session-store.ts` (new)

Stores sessions as JSON files in `.sessions/<id>.json`.

```typescript
import { Effect, FileSystem, Layer, Schema } from "effect";
import { SessionData, SessionMetadata } from "../../domain/models/session.ts";
import {
  SessionNotFound,
  SessionStore,
  SessionStoreError,
  type SessionStoreShape,
} from "../../ports/session-store.ts";

const SESSION_DIR = ".sessions";

const makeImpl = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem;

  yield* fs.makeDirectory(SESSION_DIR, { recursive: true }).pipe(
    Effect.catchAll(() => Effect.void),
  );

  const save: SessionStoreShape["save"] = Effect.fn("session-store.save")(
    function*(data) {
      const json = JSON.stringify(
        Schema.encodeSync(SessionData)(data),
        null,
        2,
      );
      yield* fs.writeFileString(
        `${SESSION_DIR}/${data.metadata.id}.json`,
        json,
      );
    },
    Effect.catchAll((cause) => Effect.fail(new SessionStoreError({ cause }))),
  );

  const load: SessionStoreShape["load"] = Effect.fn("session-store.load")(
    function*(id) {
      const path = `${SESSION_DIR}/${id}.json`;
      const exists = yield* fs.exists(path);
      if (!exists) return yield* new SessionNotFound({ id });
      const raw = yield* fs.readFileString(path);
      return Schema.decodeSync(SessionData)(JSON.parse(raw));
    },
    Effect.catchAll((cause) => {
      if (cause._tag === "SessionNotFound") return Effect.fail(cause);
      return Effect.fail(new SessionStoreError({ cause }));
    }),
  );

  const list: SessionStoreShape["list"] = Effect.fn("session-store.list")(
    function*() {
      const files = yield* fs.readDirectory(SESSION_DIR);
      const sessions: Array<SessionMetadata> = [];
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const raw = yield* fs.readFileString(`${SESSION_DIR}/${file}`);
        const data = Schema.decodeSync(SessionData)(JSON.parse(raw));
        sessions.push(data.metadata);
      }
      return sessions;
    },
    Effect.catchAll((cause) => Effect.fail(new SessionStoreError({ cause }))),
  );

  const del: SessionStoreShape["delete"] = Effect.fn("session-store.delete")(
    function*(id) {
      yield* fs.remove(`${SESSION_DIR}/${id}.json`);
    },
    Effect.catchAll((cause) => Effect.fail(new SessionStoreError({ cause }))),
  );

  return SessionStore.of({ save, load, list, delete: del });
});

export const SessionStoreAdapter = Layer.effect(SessionStore, makeImpl);
```

---

## 4. Executor adapter: support initialization from saved JSON

**File:** `app/adapters/agent-executor.ts`

Add a `ServiceMap.Reference` for initial session JSON that the adapter reads on
construction:

```typescript
export class InitialSessionJson extends ServiceMap.Reference<string | null>(
  "app/adapters/InitialSessionJson",
  { defaultValue: () => null },
) {}
```

In `makeImpl`:

```typescript
const initialJson = yield * InitialSessionJson;
const mainChat = initialJson
  ? yield * Chat.fromJson(initialJson)
  : yield * Chat.fromPrompt(Prompt.empty);
```

---

## 5. Add `--session` CLI flag

**File:** `app/adapters/cli.ts`

```typescript
const session = Flag.string("session").pipe(
  Flag.withAlias("s"),
  Flag.withDescription("Resume a saved session by ID."),
  Flag.optional,
);
```

Wire into command handler:

```typescript
Command.make(
  "assistant",
  { prompt, model, session },
  Effect.fn("cli.assistant")(
    function*({ prompt, model: modelOption, session: sessionOption }) {
      // If session flag provided, load it and set InitialSessionJson
      if (Option.isSome(sessionOption)) {
        const store = yield* SessionStore;
        const data = yield* store.load(sessionOption.value);
        yield* Ref.set(yield* InitialSessionJson, data.chatHistory);
        // Optionally restore model from session metadata
      }
      // ... rest of handler
    },
  ),
);
```

---

## 6. Add `/session` slash commands

**File:** `app/adapters/cli.ts`

In `handleSlashCommand`:

```typescript
case "session": {
  const subcommand = args[0];
  switch (subcommand) {
    case "save": {
      const label = args.slice(1).join(" ") || null;
      const store = yield* SessionStore;
      const agent = yield* Agent;
      const executor = yield* AgentExecutor;
      const chatJson = yield* executor.exportJson;
      const id = crypto.randomUUID();
      const now = DateTime.unsafeNow();
      yield* store.save(new SessionData({
        metadata: new SessionMetadata({
          id,
          createdAt: now,
          lastAccessedAt: now,
          modelName: yield* Ref.get(yield* ModelConfig),
          label,
        }),
        chatHistory: chatJson,
      }));
      yield* terminal.display(`[session saved: ${id}${label ? ` (${label})` : ""}]\n`);
      break;
    }
    case "list": {
      const store = yield* SessionStore;
      const sessions = yield* store.list();
      if (sessions.length === 0) {
        yield* terminal.display("[no saved sessions]\n");
      } else {
        for (const s of sessions) {
          const label = s.label ? ` -- ${s.label}` : "";
          yield* terminal.display(`  ${s.id}${label} (${s.lastAccessedAt})\n`);
        }
      }
      break;
    }
    case "load": {
      const id = args[1];
      if (!id) {
        yield* terminal.display("[usage: /session load <id>]\n");
        break;
      }
      yield* terminal.display(`[session restore requires restart: bun run app/main.ts --session ${id}]\n`);
      break;
    }
    default:
      yield* terminal.display("[usage: /session save [label] | /session list | /session load <id>]\n");
  }
  break;
}
```

Note: Live session switching (without restart) is complex because the executor's Chat
instance is created at construction. For v1, `/session load` instructs the user to
restart with `--session`. A future enhancement could reinitialize the executor.

---

## 7. Auto-save on completion (optional enhancement)

In `app/application/services/agent.ts`, after each completion in interactive mode,
auto-save the session:

```typescript
if (!turn.hadToolCall && pendingMessages.size === 0) {
  yield
    * Queue.offer(
      queue,
      new CompletionOutput({ summary: turn.text, status: "completed" }),
    );

  // Auto-save session if store is available
  yield * Effect.gen(function*() {
    const store = yield* SessionStore;
    const chatJson = yield* executor.exportJson;
    // ... save with current session ID
  }).pipe(Effect.catchAll(() => Effect.void)); // silently skip if no store
}
```

This is optional for v1 and can be deferred.

---

## 8. Wire SessionStore in main.ts

**File:** `app/main.ts`

```typescript
import { SessionStoreAdapter } from "./adapters/services/session-store.ts";

const AppLayer = AgentService.pipe(
  Layer.provideMerge(AgentExecutorAdapter),
  Layer.provideMerge(SessionStoreAdapter),
  Layer.provideMerge(BunServices.layer),
);
```

---

## Acceptance criteria

1. `bun lint:check` passes.
2. `SessionStore` port exists with `save`, `load`, `list`, `delete` methods.
3. Filesystem adapter stores JSON files in `.sessions/<id>.json`.
4. `--session <id>` flag restores a saved session's conversation history.
5. In interactive mode:
   - `/session save [label]` saves the current session and displays the ID.
   - `/session list` shows all saved sessions with IDs, labels, and timestamps.
   - `/session load <id>` shows the restart instruction.
6. `SessionData` contains `metadata` (id, timestamps, model, label) and `chatHistory`
   (opaque JSON string from `executor.exportJson`).
7. The Agent service does not import `Chat` or any `effect/unstable/ai` types for
   session handling.
