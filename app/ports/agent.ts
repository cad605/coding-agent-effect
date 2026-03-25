import { type Effect, Schema, ServiceMap } from "effect";

export class AgentError extends Schema.TaggedErrorClass<AgentError>()("AgentError", {
  message: Schema.String,
  cause: Schema.Defect,
}) {}

export interface AgentShape {
  send(
    { prompt }: { prompt: string },
  ): Effect.Effect<string, AgentError, never>;
}

export class Agent extends ServiceMap.Service<Agent, AgentShape>()(
  "app/ports/Agent",
) {}
