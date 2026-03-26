import { type Effect, ServiceMap, type Stream } from "effect";

import type { AgentExecutorError } from "../domain/errors/agent-executor.ts";
import type { TurnEvent } from "../domain/models/agent-executor.ts";

export interface AgentExecutorShape {
  streamTurn(options: {
    readonly userMessage?: string | null;
    readonly systemPrompt?: string | null;
  }): Stream.Stream<TurnEvent, AgentExecutorError>;

  fork(): Effect.Effect<AgentExecutorShape, AgentExecutorError>;

  readonly exportJson: Effect.Effect<string, AgentExecutorError>;
}

export class AgentExecutor extends ServiceMap.Service<AgentExecutor, AgentExecutorShape>()(
  "app/ports/AgentExecutor",
) {}
