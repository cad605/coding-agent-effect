import { Effect, Schema, ServiceMap } from "effect";
import { AiError } from "effect/unstable/ai";
import type { ToolCallPart } from "effect/unstable/ai/Response";

export class AssistantError extends Schema.TaggedErrorClass<AssistantError>()("AssistantError", {
  reason: AiError.AiErrorReason,
}) {}

export type AssistantShape = {
  answer(question: string): Effect.Effect<
    {
      readonly text: string;
      readonly toolCalls: Array<
        ToolCallPart<
          "ReadFile",
          {
            readonly filePath: string;
          }
        >
      >;
    },
    AssistantError
  >;
};

export class Assistant extends ServiceMap.Service<Assistant, AssistantShape>()(
  "@codecrafters/claude-code/Assistant",
) {}
