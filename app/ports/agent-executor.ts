import { type Effect, Schema, ServiceMap } from "effect";

import { AgentRunMessage, AgentRunState } from "./agent-runtime.ts";

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

export class AgentExecutorAssistantTextEvent extends Schema.TaggedClass("AgentExecutorAssistantTextEvent")(
  "AssistantText",
  {
    text: Schema.String,
  },
) {}

export class AgentExecutorToolCallEvent extends Schema.TaggedClass("AgentExecutorToolCallEvent")(
  "ToolCall",
  {
    toolName: Schema.String,
    input: Schema.String,
  },
) {}

export class AgentExecutorToolResultEvent extends Schema.TaggedClass("AgentExecutorToolResultEvent")(
  "ToolResult",
  {
    toolName: Schema.String,
    output: Schema.NullOr(Schema.String),
    durationMs: Schema.Number,
    truncated: Schema.Boolean,
  },
) {}

export class AgentExecutorToolFailureEvent extends Schema.TaggedClass("AgentExecutorToolFailureEvent")(
  "ToolFailure",
  {
    toolName: Schema.String,
    message: Schema.String,
    durationMs: Schema.Number,
    truncated: Schema.Boolean,
  },
) {}

export class AgentExecutorCompletionEvent extends Schema.TaggedClass("AgentExecutorCompletionEvent")(
  "Completion",
  {
    summary: Schema.String,
    status: Schema.Literal("completed"),
  },
) {}

export const AgentExecutorEvent = Schema.Union([
  AgentExecutorAssistantTextEvent,
  AgentExecutorToolCallEvent,
  AgentExecutorToolResultEvent,
  AgentExecutorToolFailureEvent,
  AgentExecutorCompletionEvent,
]);
export type AgentExecutorEvent =
  | AgentExecutorAssistantTextEvent
  | AgentExecutorToolCallEvent
  | AgentExecutorToolResultEvent
  | AgentExecutorToolFailureEvent
  | AgentExecutorCompletionEvent;

export class AgentExecutorTurnInput extends Schema.Class("AgentExecutorTurnInput")({
  run: AgentRunState,
}) {
  declare readonly run: AgentRunState;
}

export class AgentExecutorTurnResult extends Schema.Class("AgentExecutorTurnResult")({
  messages: Schema.Array(AgentRunMessage),
  events: Schema.Array(AgentExecutorEvent),
}) {
  declare readonly messages: ReadonlyArray<AgentRunMessage>;
  declare readonly events: ReadonlyArray<AgentExecutorEvent>;
}

export interface AgentExecutorShape {
  executeTurn(
    input: AgentExecutorTurnInput,
  ): Effect.Effect<AgentExecutorTurnResult, AgentExecutorError, never>;
}

export class AgentExecutor extends ServiceMap.Service<AgentExecutor, AgentExecutorShape>()(
  "app/ports/AgentExecutor",
) {}
