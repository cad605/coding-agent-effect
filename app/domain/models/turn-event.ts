import { Schema } from "effect";

import { TokenCount, ToolCallId, ToolName, ToolOutput } from "./primitives.ts";

export class TextDelta extends Schema.TaggedClass("TextDelta")("TextDelta", {
  delta: Schema.String,
}) {}

export class ReasoningDelta extends Schema.TaggedClass("ReasoningDelta")("ReasoningDelta", {
  delta: Schema.String,
}) {}

export class ToolCall extends Schema.TaggedClass("ToolCall")("ToolCall", {
  name: ToolName,
  id: ToolCallId,
}) {}

export class ToolResult extends Schema.TaggedClass("ToolResult")("ToolResult", {
  name: ToolName,
  id: ToolCallId,
  output: ToolOutput,
  isFailure: Schema.Boolean,
}) {}

export class Usage extends Schema.TaggedClass("Usage")("Usage", {
  inputTokens: TokenCount,
  outputTokens: TokenCount,
}) {}

export type TurnEvent = TextDelta | ReasoningDelta | ToolCall | ToolResult | Usage;

export const TurnEvent = Schema.Union([
  TextDelta,
  ReasoningDelta,
  ToolCall,
  ToolResult,
  Usage,
]);
