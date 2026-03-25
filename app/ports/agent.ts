import { type Effect, Match, Schema, ServiceMap, type Stream } from "effect";

import type { AgentRunInput } from "./agent-runtime.ts";

export class TurnBudgetExceeded extends Schema.TaggedErrorClass<TurnBudgetExceeded>()("TurnBudgetExceeded", {
  maxTurns: Schema.Number,
}) {}

export class MissingCompletionSignal
  extends Schema.TaggedErrorClass<MissingCompletionSignal>()("MissingCompletionSignal", {})
{}

export class UnsupportedRunMessage extends Schema.TaggedErrorClass<UnsupportedRunMessage>()(
  "UnsupportedRunMessage",
  {
    role: Schema.String,
  },
) {}

export class UnsupportedRunPart extends Schema.TaggedErrorClass<UnsupportedRunPart>()("UnsupportedRunPart", {
  partType: Schema.String,
}) {}

export class ToolExecutionFailed extends Schema.TaggedErrorClass<ToolExecutionFailed>()("ToolExecutionFailed", {
  toolName: Schema.String,
  message: Schema.String,
}) {}

export class ModelExecutionFailed extends Schema.TaggedErrorClass<ModelExecutionFailed>()("ModelExecutionFailed", {}) {}

export const AgentTurnFailureReason = Schema.Union([
  UnsupportedRunMessage,
  UnsupportedRunPart,
  ToolExecutionFailed,
  ModelExecutionFailed,
]);

export class ExecuteTurnFailed extends Schema.TaggedErrorClass<ExecuteTurnFailed>()("ExecuteTurnFailed", {
  reason: AgentTurnFailureReason,
}) {}

export class SessionFailed extends Schema.TaggedErrorClass<SessionFailed>()("SessionFailed", {
  cause: Schema.Defect,
}) {}

export const AgentFailureReason = Schema.Union([
  TurnBudgetExceeded,
  MissingCompletionSignal,
  ExecuteTurnFailed,
  SessionFailed,
]);

const formatAgentFailure = (
  reason: TurnBudgetExceeded | MissingCompletionSignal | ExecuteTurnFailed | SessionFailed,
): string =>
  Match.valueTags(reason, {
    TurnBudgetExceeded: ({ maxTurns }) =>
      `Agent exceeded the maximum number of turns (${maxTurns}) without explicit completion`,
    MissingCompletionSignal: () => "Agent turn ended without explicit completion or tool activity",
    ExecuteTurnFailed: ({ reason }) =>
      Match.valueTags(reason, {
        UnsupportedRunMessage: ({ role }) => `Unsupported run message role: ${role}`,
        UnsupportedRunPart: ({ partType }) => `Unsupported run message part type: ${partType}`,
        ToolExecutionFailed: ({ toolName, message }) => `Tool ${toolName} failed: ${message}`,
        ModelExecutionFailed: () => "Failed to execute agent turn",
      }),
    SessionFailed: () => "Failed to act",
  });

export class AgentError extends Schema.TaggedErrorClass<AgentError>()("AgentError", {
  reason: AgentFailureReason,
}) {
  override get message(): string {
    return formatAgentFailure(this.reason);
  }
}

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

export interface AgentShape {
  send(
    input: AgentRunInput,
  ): Effect.Effect<Stream.Stream<AgentEvent, AgentError>, AgentError, never>;
}

export class Agent extends ServiceMap.Service<Agent, AgentShape>()(
  "app/ports/Agent",
) {}
