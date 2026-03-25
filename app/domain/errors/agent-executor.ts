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

const formatAgentExecutorFailure = (
  reason: ToolRuntimeFailed | ModelTurnFailed,
): string => {
  switch (reason._tag) {
    case "ToolRuntimeFailed":
      return `Tool ${reason.toolName} failed: ${reason.message}`;
    case "ModelTurnFailed":
      return "Failed to execute turn";
  }
};

export class AgentExecutorError extends Schema.TaggedErrorClass<AgentExecutorError>()("AgentExecutorError", {
  reason: AgentExecutorFailureReason,
}) {
  override get message(): string {
    return formatAgentExecutorFailure(this.reason);
  }
}
