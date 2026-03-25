import { type Effect, ServiceMap, type Stream } from "effect";

import type { AgentError } from "../domain/errors/agent.ts";
import type { AgentEvent } from "../domain/models/agent-events.ts";
import type { AgentRunInput } from "../domain/models/agent-run.ts";

export interface AgentShape {
  send(
    input: AgentRunInput,
  ): Effect.Effect<Stream.Stream<AgentEvent, AgentError>, AgentError, never>;
}

export class Agent extends ServiceMap.Service<Agent, AgentShape>()(
  "app/ports/Agent",
) {}
