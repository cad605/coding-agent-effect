import { Schema } from "effect";

export class TextDelta extends Schema.TaggedClass("TextDelta")("TextDelta", {
  delta: Schema.String,
}) {}

export class ReasoningDelta extends Schema.TaggedClass("ReasoningDelta")("ReasoningDelta", {
  delta: Schema.String,
}) {}

export class ToolCall extends Schema.TaggedClass("ToolCall")("ToolCall", {
  name: Schema.String,
  id: Schema.String,
}) {}

export class ToolResult extends Schema.TaggedClass("ToolResult")("ToolResult", {
  name: Schema.String,
  id: Schema.String,
  output: Schema.String,
  isFailure: Schema.Boolean,
}) {}

export class Usage extends Schema.TaggedClass("Usage")("Usage", {
  inputTokens: Schema.Number,
  outputTokens: Schema.Number,
}) {}

export class Ignored extends Schema.TaggedClass("Ignored")("Ignored", {}) {}

export type TurnEvent = TextDelta | ReasoningDelta | ToolCall | ToolResult | Usage | Ignored;

export const TurnEvent = Schema.Union([
  TextDelta,
  ReasoningDelta,
  ToolCall,
  ToolResult,
  Usage,
  Ignored,
]);
