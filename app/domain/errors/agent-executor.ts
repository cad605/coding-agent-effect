import { Schema } from "effect";

export class UnsupportedRuntimeMessage extends Schema.TaggedErrorClass<UnsupportedRuntimeMessage>()(
  "UnsupportedRuntimeMessage",
  {
    role: Schema.String,
  },
) {}

export class UnsupportedRuntimePart extends Schema.TaggedErrorClass<UnsupportedRuntimePart>()(
  "UnsupportedRuntimePart",
  {
    partType: Schema.String,
  },
) {}

export class ToolRuntimeFailed extends Schema.TaggedErrorClass<ToolRuntimeFailed>()("ToolRuntimeFailed", {
  toolName: Schema.String,
  message: Schema.String,
}) {}

export class ModelTurnFailed extends Schema.TaggedErrorClass<ModelTurnFailed>()("ModelTurnFailed", {
  cause: Schema.Defect,
}) {}

export const AgentExecutorFailureReason = Schema.Union([
  UnsupportedRuntimeMessage,
  UnsupportedRuntimePart,
  ToolRuntimeFailed,
  ModelTurnFailed,
]);

const formatAgentExecutorFailure = (
  reason: UnsupportedRuntimeMessage | UnsupportedRuntimePart | ToolRuntimeFailed | ModelTurnFailed,
): string => {
  switch (reason._tag) {
    case "UnsupportedRuntimeMessage":
      return `Unsupported runtime message role: ${reason.role}`;
    case "UnsupportedRuntimePart":
      return `Unsupported runtime message part type: ${reason.partType}`;
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
