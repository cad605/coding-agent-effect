import { Schema } from "effect";

export class AgentTextEvent extends Schema.TaggedClass("AgentTextEvent")("AgentText", {
  text: Schema.String,
}) {}

export class AgentToolCallEvent extends Schema.TaggedClass("AgentToolCallEvent")("AgentToolCall", {
  toolName: Schema.String,
  input: Schema.String,
}) {}

export class AgentToolResultEvent extends Schema.TaggedClass("AgentToolResultEvent")("AgentToolResult", {
  toolName: Schema.String,
  output: Schema.NullOr(Schema.String),
  durationMs: Schema.Number,
  truncated: Schema.Boolean,
}) {}

export class AgentToolFailureEvent extends Schema.TaggedClass("AgentToolFailureEvent")("AgentToolFailure", {
  toolName: Schema.String,
  message: Schema.String,
  durationMs: Schema.Number,
  truncated: Schema.Boolean,
}) {}

export class AgentCompletionEvent extends Schema.TaggedClass("AgentCompletionEvent")("AgentCompletion", {
  summary: Schema.String,
  status: Schema.Literal("completed"),
}) {}

export const AgentEvent = Schema.Union([
  AgentTextEvent,
  AgentToolCallEvent,
  AgentToolResultEvent,
  AgentToolFailureEvent,
  AgentCompletionEvent,
]);
export type AgentEvent =
  | AgentTextEvent
  | AgentToolCallEvent
  | AgentToolResultEvent
  | AgentToolFailureEvent
  | AgentCompletionEvent;
