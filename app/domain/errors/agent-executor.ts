import { Schema } from "effect";

export class ToolRuntimeFailed extends Schema.TaggedErrorClass<ToolRuntimeFailed>()("ToolRuntimeFailed", {
  toolName: Schema.String,
  message: Schema.String,
}) {}

export class ModelTurnFailed extends Schema.TaggedErrorClass<ModelTurnFailed>()("ModelTurnFailed", {
  cause: Schema.Defect,
}) {}

export const AgentExecutorFailureReason = Schema.Union([
  ToolRuntimeFailed,
  ModelTurnFailed,
]);

export class AgentExecutorError extends Schema.TaggedErrorClass<AgentExecutorError>()("AgentExecutorError", {
  reason: AgentExecutorFailureReason,
}) {}
