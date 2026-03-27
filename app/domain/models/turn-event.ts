import { Schema } from "effect";

export class TextDelta extends Schema.TaggedClass("TextDelta")("TextDelta", {
  delta: Schema.String,
}) {}

export class TextEnd extends Schema.TaggedClass("TextEnd")("TextEnd", {}) {}

export class ReasoningDelta extends Schema.TaggedClass("ReasoningDelta")("ReasoningDelta", {
  delta: Schema.String,
}) {}

export class ReasoningEnd extends Schema.TaggedClass("ReasoningEnd")("ReasoningEnd", {}) {}

export class Ignored extends Schema.TaggedClass("Ignored")("Ignored", {}) {}

export type TurnEvent = TextDelta | TextEnd | ReasoningDelta | ReasoningEnd | Ignored;

export const TurnEvent = Schema.Union([
  TextDelta,
  TextEnd,
  ReasoningDelta,
  ReasoningEnd,
  Ignored,
]);
