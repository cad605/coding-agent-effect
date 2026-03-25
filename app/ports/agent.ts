import { type Effect, ServiceMap, type Stream } from "effect";

import type { AgentError } from "../domain/errors/agent.ts";
import type { AgentRunInput } from "../domain/models/agent-run.ts";
import type { Output } from "../domain/models/output.ts";

export interface AgentShape {
  send(
    input: AgentRunInput,
  ): Effect.Effect<Stream.Stream<Output, AgentError>, AgentError, never>;
}

export class Agent extends ServiceMap.Service<Agent, AgentShape>()(
  "app/ports/Agent",
) {}
