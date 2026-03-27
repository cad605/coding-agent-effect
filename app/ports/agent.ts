import { type Effect, Schema, ServiceMap, type Stream } from "effect";

import type { AgentError } from "../domain/errors/agent.ts";
import type { TurnEvent } from "../domain/models/turn-event.ts";

export class AgentSendInput extends Schema.Class("AgentSendInput")({
  prompt: Schema.String,
}) {}

export interface AgentShape {
  send(input: AgentSendInput): Effect.Effect<Stream.Stream<TurnEvent, AgentError>, never>;
}

export class Agent extends ServiceMap.Service<Agent, AgentShape>()(
  "app/ports/Agent",
) {}
