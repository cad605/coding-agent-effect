import { Schema } from "effect";

export class TurnBudgetExceeded extends Schema.TaggedErrorClass<TurnBudgetExceeded>()("TurnBudgetExceeded", {
  maxTurns: Schema.Number,
}) {}

export class ModelExecutionFailed extends Schema.TaggedErrorClass<ModelExecutionFailed>()("ModelExecutionFailed", {}) {}

export const AgentTurnFailureReason = Schema.Union([
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
