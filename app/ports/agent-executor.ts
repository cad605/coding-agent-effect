import { type Effect, ServiceMap } from "effect";

import type { AgentExecutorError } from "../domain/errors/agent-executor.ts";
import type { AgentExecutorTurnResult } from "../domain/models/agent-executor.ts";
import type { AgentRunInput } from "../domain/models/agent-run.ts";
import type { Output } from "../domain/models/output.ts";

export interface AgentExecutorSession {
  executeTurn(): Effect.Effect<AgentExecutorTurnResult, AgentExecutorError, never>;
}

export interface AgentExecutorShape {
  createSession(
    input: AgentRunInput,
    emit: (output: Output) => Effect.Effect<void, never, never>,
  ): Effect.Effect<AgentExecutorSession, AgentExecutorError, never>;
}

export class AgentExecutor extends ServiceMap.Service<AgentExecutor, AgentExecutorShape>()(
  "app/ports/AgentExecutor",
) {}
