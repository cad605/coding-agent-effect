import { Schema } from "effect";

export class ModelTurnFailed extends Schema.TaggedErrorClass<ModelTurnFailed>()("ModelTurnFailed", {
  cause: Schema.Defect,
}) {}

export const AgentExecutorFailureReason = Schema.Union([
  ModelTurnFailed,
]);

export class AgentExecutorError extends Schema.TaggedErrorClass<AgentExecutorError>()("AgentExecutorError", {
  reason: AgentExecutorFailureReason,
}) {}
