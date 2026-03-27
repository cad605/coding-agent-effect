import { type Effect, Schema, ServiceMap } from "effect";

import type { SessionNotFoundError, SessionStoreError } from "../domain/errors/session-store.ts";
import { SessionId } from "../domain/models/primitives.ts";
import type { SessionMetadata } from "../domain/models/session.ts";

export interface SessionData {
  readonly metadata: SessionMetadata;
  readonly history: string;
}

export class SessionStoreSaveInput extends Schema.Class("SessionStoreSaveInput")({
  sessionId: SessionId,
  history: Schema.String,
}) {}

export class SessionStoreLoadInput extends Schema.Class("SessionStoreLoadInput")({
  sessionId: SessionId,
}) {}

export interface SessionStoreShape {
  create(): Effect.Effect<SessionMetadata, SessionStoreError>;
  load(input: SessionStoreLoadInput): Effect.Effect<SessionData, SessionStoreError | SessionNotFoundError>;
  save(input: SessionStoreSaveInput): Effect.Effect<SessionMetadata, SessionStoreError | SessionNotFoundError>;
  loadLatest(): Effect.Effect<SessionData, SessionStoreError | SessionNotFoundError>;
}

export class SessionStore extends ServiceMap.Service<SessionStore, SessionStoreShape>()(
  "app/ports/SessionStore",
) {}
