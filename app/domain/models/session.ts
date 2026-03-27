import { Schema } from "effect";

import { SessionId } from "./primitives.ts";

export class SessionMetadata extends Schema.Class("SessionMetadata")({
  sessionId: SessionId,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
}) {}

export const NewSession = Schema.TaggedStruct("NewSession", {});

export const ContinueSession = Schema.TaggedStruct("ContinueSession", {});

export const ResumeSession = Schema.TaggedStruct("ResumeSession", {
  sessionId: SessionId,
});

export const SessionIntent = Schema.Union([NewSession, ContinueSession, ResumeSession]).pipe(
  Schema.toTaggedUnion("_tag"),
);
export type SessionIntent = typeof SessionIntent.Type;
