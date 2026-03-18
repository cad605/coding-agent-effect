import { type Effect, type FileSystem, Schema, ServiceMap } from "effect";
import { AiError } from "effect/unstable/ai";
import type { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner";

export class AgentError extends Schema.TaggedErrorClass<AgentError>()("AgentError", {
  reason: AiError.AiErrorReason,
}) {
  static fromAiError(error: AiError.AiError) {
    return new AgentError({ reason: error.reason });
  }
}

export type AgentShape = {
  answer(
    content: string,
  ): Effect.Effect<string, AgentError, FileSystem.FileSystem | ChildProcessSpawner>;
};

export class Agent extends ServiceMap.Service<Agent, AgentShape>()(
  "@codecrafters/claude-code/Agent",
) {}
