import { Schema } from "effect";

export class TextDelta extends Schema.TaggedClass("TextDelta")("TextDelta", {
  delta: Schema.String,
}) {}

export class TextEnd extends Schema.TaggedClass("TextEnd")("TextEnd", {}) {}

export class ReasoningDelta extends Schema.TaggedClass("ReasoningDelta")("ReasoningDelta", {
  delta: Schema.String,
}) {}

export class ReasoningEnd extends Schema.TaggedClass("ReasoningEnd")("ReasoningEnd", {}) {}

export class ToolCallStart extends Schema.TaggedClass("ToolCallStart")("ToolCallStart", {
  toolName: Schema.String,
  toolCallId: Schema.String,
}) {}

export class ToolResult extends Schema.TaggedClass("ToolResult")("ToolResult", {
  toolName: Schema.String,
  toolCallId: Schema.String,
  output: Schema.String,
  isFailure: Schema.Boolean,
}) {}

export class UsageReport extends Schema.TaggedClass("UsageReport")("UsageReport", {
  inputTokens: Schema.Number,
  outputTokens: Schema.Number,
}) {}

export class TurnComplete extends Schema.TaggedClass("TurnComplete")("TurnComplete", {
  hadToolCall: Schema.Boolean,
  text: Schema.String,
}) {}

export type TurnEvent =
  | TextDelta
  | TextEnd
  | ReasoningDelta
  | ReasoningEnd
  | ToolCallStart
  | ToolResult
  | UsageReport
  | TurnComplete;

export const TurnEvent = Schema.Union([
  TextDelta,
  TextEnd,
  ReasoningDelta,
  ReasoningEnd,
  ToolCallStart,
  ToolResult,
  UsageReport,
  TurnComplete,
]);
