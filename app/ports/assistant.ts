import { Effect, Schema, ServiceMap } from "effect";
import { AiError } from "effect/unstable/ai";

export class AssistantError extends Schema.TaggedErrorClass<AssistantError>()("AssistantError", {
  reason: AiError.AiErrorReason,
}) {}

export type AssistantShape = {
  answer(question: string): Effect.Effect<string, AssistantError>;
};

export class Assistant extends ServiceMap.Service<Assistant, AssistantShape>()(
  "@codecrafters/claude-code/Assistant",
) {}
