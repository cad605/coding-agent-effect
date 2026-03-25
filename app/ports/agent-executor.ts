import { type Effect, Schema, ServiceMap } from "effect";
import type * as Prompt from "effect/unstable/ai/Prompt";

export class AgentExecutorError extends Schema.TaggedErrorClass<AgentExecutorError>()("AgentExecutorError", {
  message: Schema.String,
  cause: Schema.Defect,
}) {}

export class ToolExecutionMetadata extends Schema.Class("ToolExecutionMetadata")({
  durationMs: Schema.Number,
  truncated: Schema.Boolean,
}) {}

export class AgentCompletion extends Schema.Class("AgentCompletion")({
  summary: Schema.String,
  status: Schema.Literal("completed"),
}) {}

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

export interface AgentExecutorTurn {
  readonly prompt: Prompt.Prompt;
  readonly events: ReadonlyArray<AgentExecutorEvent>;
}

export interface AgentExecutorShape {
  executeTurn(
    { prompt }: { prompt: Prompt.Prompt },
  ): Effect.Effect<AgentExecutorTurn, AgentExecutorError, never>;
}

export class AgentExecutor extends ServiceMap.Service<AgentExecutor, AgentExecutorShape>()(
  "app/ports/AgentExecutor",
) {}
