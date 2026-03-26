import { ServiceMap, type Stream } from "effect";

import type { AgentExecutorError } from "../domain/errors/agent-executor.ts";
import type { TurnEvent, TurnInput } from "../domain/models/agent-executor.ts";

export interface AgentExecutorShape {
  executeTurn(
    input: TurnInput,
  ): Stream.Stream<TurnEvent, AgentExecutorError>;
}

export class AgentExecutor extends ServiceMap.Service<AgentExecutor, AgentExecutorShape>()(
  "app/ports/AgentExecutor",
) {}
