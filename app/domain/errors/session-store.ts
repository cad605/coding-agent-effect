import { Schema } from "effect";

export class SessionStoreError extends Schema.TaggedErrorClass<SessionStoreError>()("SessionStoreError", {
  cause: Schema.Defect,
}) {}

export class SessionNotFoundError extends Schema.TaggedErrorClass<SessionNotFoundError>()("SessionNotFoundError", {
  message: Schema.String,
}) {}
