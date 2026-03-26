import { ServiceMap, type Stream } from "effect";
import type { Prompt } from "effect/unstable/ai";

import type { AgentExecutorError } from "../domain/errors/agent-executor.ts";
import type { TurnEvent } from "../domain/models/agent-executor.ts";

export interface AgentExecutorShape {
  executeTurn(
    prompt: Prompt.Prompt,
  ): Stream.Stream<TurnEvent, AgentExecutorError>;
}

export class AgentExecutor extends ServiceMap.Service<AgentExecutor, AgentExecutorShape>()(
  "app/ports/AgentExecutor",
) {}
