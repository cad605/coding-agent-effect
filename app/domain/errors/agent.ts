import { Schema } from "effect";

export class TurnBudgetExceeded extends Schema.TaggedErrorClass<TurnBudgetExceeded>()("TurnBudgetExceeded", {
  maxTurns: Schema.Number,
}) {}

export class ToolExecutionFailed extends Schema.TaggedErrorClass<ToolExecutionFailed>()("ToolExecutionFailed", {
  toolName: Schema.String,
  message: Schema.String,
}) {}

export class ModelExecutionFailed extends Schema.TaggedErrorClass<ModelExecutionFailed>()("ModelExecutionFailed", {}) {}

export const AgentTurnFailureReason = Schema.Union([
  ToolExecutionFailed,
  ModelExecutionFailed,
]);

export class ExecuteTurnFailed extends Schema.TaggedErrorClass<ExecuteTurnFailed>()("ExecuteTurnFailed", {
  reason: AgentTurnFailureReason,
}) {}

export const AgentFailureReason = Schema.Union([
  TurnBudgetExceeded,
  ExecuteTurnFailed,
]);

export class AgentError extends Schema.TaggedErrorClass<AgentError>()("AgentError", {
  reason: AgentFailureReason,
}) {}
