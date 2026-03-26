import { Schema } from "effect";

export class AgentTextDelta extends Schema.TaggedClass("AgentTextDelta")("AgentTextDelta", {
  delta: Schema.String,
}) {}

export class AgentToolCallStart extends Schema.TaggedClass("AgentToolCallStart")("AgentToolCallStart", {
  toolName: Schema.String,
  toolCallId: Schema.String,
}) {}

export class AgentToolResult extends Schema.TaggedClass("AgentToolResult")("AgentToolResult", {
  toolName: Schema.String,
  toolCallId: Schema.String,
  output: Schema.String,
  isFailure: Schema.Boolean,
}) {}

export class AgentUsageReport extends Schema.TaggedClass("AgentUsageReport")("AgentUsageReport", {
  inputTokens: Schema.Number,
  outputTokens: Schema.Number,
}) {}

export class CompletionOutput extends Schema.TaggedClass("CompletionOutput")("Completion", {
  summary: Schema.String,
  status: Schema.Literal("completed"),
}) {}

export type Output = AgentTextDelta | AgentToolCallStart | AgentToolResult | AgentUsageReport | CompletionOutput;

export const Output = Schema.Union([
  AgentTextDelta,
  AgentToolCallStart,
  AgentToolResult,
  AgentUsageReport,
  CompletionOutput,
]);
