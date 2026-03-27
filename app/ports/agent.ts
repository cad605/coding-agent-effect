import { type Effect, Schema, ServiceMap, type Stream } from "effect";

import type { AgentError } from "../domain/errors/agent.ts";
import type { AgentResponse } from "../domain/models/agent-response.ts";

export class AgentSendInput extends Schema.Class("AgentSendInput")({
  prompt: Schema.String,
}) {}

export interface AgentShape {
  send(input: AgentSendInput): Effect.Effect<Stream.Stream<AgentResponse, AgentError>, never>;
}

export class Agent extends ServiceMap.Service<Agent, AgentShape>()(
  "app/ports/Agent",
) {}
