import { type Effect, Schema, ServiceMap } from "effect";
import type { Prompt } from "effect/unstable/ai";

export class AgentExecutorError extends Schema.TaggedErrorClass<AgentExecutorError>()("AgentExecutorError", {
  message: Schema.String,
  cause: Schema.Defect,
}) {}

export interface AgentExecutorShape {
  generateResponse(
    { prompt }: { prompt: Prompt.RawInput },
  ): Effect.Effect<string, AgentExecutorError, never>;
}

export class AgentExecutor extends ServiceMap.Service<AgentExecutor, AgentExecutorShape>()(
  "app/ports/AgentExecutor",
) {}
