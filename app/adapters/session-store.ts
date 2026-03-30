import { DateTime, Effect, Layer } from "effect";
import { Chat, IdGenerator } from "effect/unstable/ai";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { SessionNotFoundError, SessionStoreError } from "../domain/errors/session-store.ts";
import { SessionId } from "../domain/models/primitives.ts";
import { SessionMetadata } from "../domain/models/session.ts";
import { SessionStore, type SessionStoreShape } from "../ports/session-store.ts";

const SESSION_METADATA_TABLE = "session_metadata";

const makeImpl = Effect.gen(function*() {
  const sql = (yield* SqlClient.SqlClient).withoutTransforms();
  const idGenerator = yield* IdGenerator.IdGenerator;
  const chatPersistence = yield* Chat.Persistence;
  const table = sql(SESSION_METADATA_TABLE);

  yield* sql`
    CREATE TABLE IF NOT EXISTS ${table} (
      session_id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `.pipe(
    Effect.mapError((cause) => new SessionStoreError({ cause })),
  );

  const toMetadata = (row: {
    readonly session_id: string;
    readonly created_at: number;
    readonly updated_at: number;
  }) =>
    new SessionMetadata({
      sessionId: SessionId.makeUnsafe(row.session_id),
      createdAt: new Date(Number(row.created_at)),
      updatedAt: new Date(Number(row.updated_at)),
    });

  const loadMetadata = Effect.fn("sessionStore.loadMetadata")(function*(sessionId: string) {
    const rows = yield* sql<{
      readonly session_id: string;
      readonly created_at: number;
      readonly updated_at: number;
    }>`
      SELECT session_id, created_at, updated_at
      FROM ${table}
      WHERE session_id = ${sessionId}
    `.pipe(
      Effect.mapError((cause) => new SessionStoreError({ cause })),
    );

    const row = rows[0];
    if (row === undefined) {
      return yield* new SessionNotFoundError({ message: `Session not found: ${sessionId}` });
    }

    return toMetadata(row);
  });

  const create: SessionStoreShape["create"] = Effect.fn("sessionStore.create")(
    function*() {
      const id = yield* idGenerator.generateId();
      const now = yield* DateTime.nowAsDate;
      const sessionId = SessionId.makeUnsafe(id);
      const nowMillis = now.getTime();

      const metadata = new SessionMetadata({
        sessionId,
        createdAt: now,
        updatedAt: now,
      });

      yield* sql`
        INSERT INTO ${table} (session_id, created_at, updated_at)
        VALUES (${id}, ${nowMillis}, ${nowMillis})
      `.pipe(
        Effect.mapError((cause) => new SessionStoreError({ cause })),
      );

      yield* chatPersistence.getOrCreate(id).pipe(
        Effect.asVoid,
        Effect.tapError(() =>
          sql`
            DELETE FROM ${table}
            WHERE session_id = ${id}
          `.pipe(
            Effect.ignore,
          )
        ),
        Effect.mapError((cause) => new SessionStoreError({ cause })),
      );

      return metadata;
    },
  );

  const load: SessionStoreShape["load"] = Effect.fn("sessionStore.load")(
    function*({ sessionId }) {
      return yield* loadMetadata(sessionId);
    },
  );

  const touch: SessionStoreShape["touch"] = Effect.fn("sessionStore.touch")(
    function*({ sessionId }) {
      const existing = yield* loadMetadata(sessionId);
      const now = yield* DateTime.nowAsDate;
      const nowMillis = now.getTime();

      yield* sql`
        UPDATE ${table}
        SET updated_at = ${nowMillis}
        WHERE session_id = ${sessionId}
      `.pipe(
        Effect.mapError((cause) => new SessionStoreError({ cause })),
      );

      return new SessionMetadata({
        sessionId: existing.sessionId,
        createdAt: existing.createdAt,
        updatedAt: now,
      });
    },
  );

  const loadLatest: SessionStoreShape["loadLatest"] = Effect.fn("sessionStore.loadLatest")(
    function*() {
      const rows = yield* sql<{
        readonly session_id: string;
        readonly created_at: number;
        readonly updated_at: number;
      }>`
        SELECT session_id, created_at, updated_at
        FROM ${table}
        ORDER BY updated_at DESC
        LIMIT 1
      `.pipe(
        Effect.mapError((cause) => new SessionStoreError({ cause })),
      );

      const row = rows[0];
      if (row === undefined) {
        return yield* new SessionNotFoundError({ message: "No sessions found" });
      }

      return toMetadata(row);
    },
  );

  const list: SessionStoreShape["list"] = Effect.fn("sessionStore.list")(
    function*() {
      const rows = yield* sql<{
        readonly session_id: string;
        readonly created_at: number;
        readonly updated_at: number;
      }>`
        SELECT session_id, created_at, updated_at
        FROM ${table}
        ORDER BY updated_at DESC
      `.pipe(
        Effect.mapError((cause) => new SessionStoreError({ cause })),
      );

      return rows.map(toMetadata);
    },
  );

  return SessionStore.of({ create, load, touch, loadLatest, list }) satisfies SessionStoreShape;
});

export const SessionStoreAdapter = Layer.effect(SessionStore, makeImpl);
