import { type Effect, Schema, ServiceMap, type Stream } from "effect";

import type { AgentError } from "../domain/errors/agent.ts";
import { Prompt } from "../domain/models/primitives.ts";
import type { SessionMetadata } from "../domain/models/session.ts";
import { SessionIntent } from "../domain/models/session.ts";
import type { TurnEvent } from "../domain/models/turn-event.ts";

export class AgentSendInput extends Schema.Class("AgentSendInput")({
  prompt: Prompt,
  sessionIntent: SessionIntent,
}) {}

export interface AgentShape {
  send(input: AgentSendInput): Effect.Effect<Stream.Stream<TurnEvent, AgentError, never>, AgentError, never>;
  listSessions(): Effect.Effect<ReadonlyArray<SessionMetadata>, AgentError, never>;
}

export class Agent extends ServiceMap.Service<Agent, AgentShape>()(
  "app/ports/Agent",
) {}
