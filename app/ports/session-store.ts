import { type Effect, Schema, ServiceMap } from "effect";

import type { SessionNotFoundError, SessionStoreError } from "../domain/errors/session-store.ts";
import { SessionId } from "../domain/models/primitives.ts";
import type { SessionMetadata } from "../domain/models/session.ts";

export class SessionStoreTouchInput extends Schema.Class("SessionStoreTouchInput")({
  sessionId: SessionId,
}) {}

export class SessionStoreLoadInput extends Schema.Class("SessionStoreLoadInput")({
  sessionId: SessionId,
}) {}

export interface SessionStoreShape {
  create(): Effect.Effect<SessionMetadata, SessionStoreError>;
  load(input: SessionStoreLoadInput): Effect.Effect<SessionMetadata, SessionStoreError | SessionNotFoundError>;
  touch(input: SessionStoreTouchInput): Effect.Effect<SessionMetadata, SessionStoreError | SessionNotFoundError>;
  loadLatest(): Effect.Effect<SessionMetadata, SessionStoreError | SessionNotFoundError>;
}

export class SessionStore extends ServiceMap.Service<SessionStore, SessionStoreShape>()(
  "app/ports/SessionStore",
) {}
