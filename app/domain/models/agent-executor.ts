import { Schema } from "effect";

import { AgentRunMessage, AgentRunState } from "./agent-run.ts";

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
    truncated: Schema.Boolean,
  },
) {}

export class AgentExecutorToolFailureEvent extends Schema.TaggedClass("AgentExecutorToolFailureEvent")(
  "ToolFailure",
  {
    toolName: Schema.String,
    message: Schema.String,
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
