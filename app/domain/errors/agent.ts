import { Match, Schema } from "effect";

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
