import { type Effect, ServiceMap } from "effect";

import type { AgentExecutorError } from "../domain/errors/agent-executor.ts";
import type { AgentExecutorTurnInput, AgentExecutorTurnResult } from "../domain/models/agent-executor.ts";

export interface AgentExecutorShape {
  executeTurn(
    input: AgentExecutorTurnInput,
  ): Effect.Effect<AgentExecutorTurnResult, AgentExecutorError, never>;
}

export class AgentExecutor extends ServiceMap.Service<AgentExecutor, AgentExecutorShape>()(
  "app/ports/AgentExecutor",
) {}
