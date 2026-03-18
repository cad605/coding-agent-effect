import { Effect, FileSystem, Schema, ServiceMap } from "effect";
import { AiError } from "effect/unstable/ai";

export class AgentError extends Schema.TaggedErrorClass<AgentError>()("AgentError", {
  reason: AiError.AiErrorReason,
}) {}

export type AgentShape = {
  answer(question: string): Effect.Effect<string, AgentError, FileSystem.FileSystem>;
};

export class Agent extends ServiceMap.Service<Agent, AgentShape>()(
  "@codecrafters/claude-code/Agent",
) {}
