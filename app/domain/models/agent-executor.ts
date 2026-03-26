import { Schema } from "effect";
import { Prompt } from "effect/unstable/ai";

export class TextDelta extends Schema.TaggedClass("TextDelta")("TextDelta", {
  delta: Schema.String,
}) {}

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
  completionSummary: Schema.NullOr(Schema.String),
  promptDelta: Prompt.Prompt,
}) {}

export type TurnEvent = TextDelta | ToolCallStart | ToolResult | UsageReport | TurnComplete;
export const TurnEvent = Schema.Union([TextDelta, ToolCallStart, ToolResult, UsageReport, TurnComplete]);
