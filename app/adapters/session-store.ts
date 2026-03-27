import { DateTime, Effect, FileSystem, Layer, Path } from "effect";
import { IdGenerator } from "effect/unstable/ai";

import { SessionNotFoundError, SessionStoreError } from "../domain/errors/session-store.ts";
import { SessionId } from "../domain/models/primitives.ts";
import { SessionMetadata } from "../domain/models/session.ts";
import { SessionStore, type SessionStoreShape } from "../ports/session-store.ts";

const SESSIONS_DIR = ".sessions";

const makeImpl = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const idGenerator = yield* IdGenerator.IdGenerator;

  yield* fs.makeDirectory(SESSIONS_DIR, { recursive: true });

  const sessionPath = (id: string) => path.join(SESSIONS_DIR, `${id}.jsonl`);

  const writeSessionFile = Effect.fn("sessionStore.writeSessionFile")(function*(
    filePath: string,
    metadata: { sessionId: string; createdAt: string; updatedAt: string },
    history: string,
  ) {
    yield* fs.writeFileString(filePath, `${JSON.stringify(metadata)}\n${history}\n`);
  });

  const parseSessionFile = Effect.fn("sessionStore.parseSessionFile")(function*(filePath: string, content: string) {
    const lines = content.split("\n").filter((l) => l.length > 0);

    if (lines.length < 1) {
      return yield* Effect.fail(new SessionStoreError({ cause: new Error(`Malformed session file: ${filePath}`) }));
    }

    const raw = JSON.parse(lines[0]) as {
      sessionId: string;
      createdAt: string;
      updatedAt: string;
    };

    return {
      metadata: new SessionMetadata({
        sessionId: SessionId.makeUnsafe(raw.sessionId),
        createdAt: new Date(raw.createdAt),
        updatedAt: new Date(raw.updatedAt),
      }),
      history: lines[1] ?? "",
    };
  });

  const readSessionFile = Effect.fn("sessionStore.readSessionFile")(function*(filePath: string) {
    const content = yield* fs.readFileString(filePath);

    return yield* parseSessionFile(filePath, content);
  });

  const create: SessionStoreShape["create"] = Effect.fn("sessionStore.create")(
    function*() {
      const id = yield* idGenerator.generateId();
      const now = yield* DateTime.nowAsDate;
      const sessionId = SessionId.makeUnsafe(id);

      const metadata = new SessionMetadata({
        sessionId,
        createdAt: now,
        updatedAt: now,
      });

      yield* writeSessionFile(
        sessionPath(id),
        {
          sessionId: id,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
        "",
      );

      return metadata;
    },
    Effect.catch((cause) => Effect.fail(new SessionStoreError({ cause }))),
  );

  const load: SessionStoreShape["load"] = Effect.fn("sessionStore.load")(
    function*({ sessionId }) {
      const filePath = sessionPath(sessionId);
      const exists = yield* fs.exists(filePath);

      if (!exists) {
        return yield* new SessionNotFoundError({ message: `Session not found: ${sessionId}` });
      }

      return yield* readSessionFile(filePath);
    },
    Effect.catch((cause) => Effect.fail(new SessionStoreError({ cause }))),
  );

  const save: SessionStoreShape["save"] = Effect.fn("sessionStore.save")(
    function*({ sessionId, history }) {
      const filePath = sessionPath(sessionId);
      const exists = yield* fs.exists(filePath);

      if (!exists) {
        return yield* new SessionNotFoundError({ message: `Session not found: ${sessionId}` });
      }

      const existing = yield* readSessionFile(filePath);
      const now = yield* DateTime.nowAsDate;

      const updatedMetadata = new SessionMetadata({
        sessionId: existing.metadata.sessionId,
        createdAt: existing.metadata.createdAt,
        updatedAt: now,
      });

      yield* writeSessionFile(
        filePath,
        {
          sessionId,
          createdAt: existing.metadata.createdAt.toISOString(),
          updatedAt: now.toISOString(),
        },
        history,
      );

      return updatedMetadata;
    },
    Effect.catch((cause) => Effect.fail(new SessionStoreError({ cause }))),
  );

  const loadLatest: SessionStoreShape["loadLatest"] = Effect.fn("sessionStore.loadLatest")(
    function*() {
      const entries = yield* fs.readDirectory(SESSIONS_DIR);

      const jsonlFiles = entries.filter((e) => e.endsWith(".jsonl"));

      if (jsonlFiles.length === 0) {
        return yield* new SessionNotFoundError({ message: "No sessions found" });
      }

      const sessions = yield* Effect.all(
        jsonlFiles.map((file) => readSessionFile(path.join(SESSIONS_DIR, file))),
        { concurrency: "unbounded" },
      );

      const sorted = sessions.slice().sort(
        (a, b) => b.metadata.updatedAt.getTime() - a.metadata.updatedAt.getTime(),
      );

      const latest = sorted[0];
      if (latest === undefined) {
        return yield* new SessionNotFoundError({ message: "No sessions found" });
      }

      return latest;
    },
    Effect.catch((cause) => Effect.fail(new SessionStoreError({ cause }))),
  );

  return SessionStore.of({ create, load, save, loadLatest }) satisfies SessionStoreShape;
});

export const SessionStoreAdapter = Layer.effect(SessionStore, makeImpl);
