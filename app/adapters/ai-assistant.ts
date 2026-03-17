import { OpenRouterLanguageModel } from "@effect/ai-openrouter";
import { Effect, Layer } from "effect";
import { LanguageModel } from "effect/unstable/ai";

import { Assistant, AssistantError } from "../ports/assistant.ts";
import { Tools } from "../ports/tools.ts";

export const AiAssistantLive = Layer.effect(
  Assistant,
  Effect.gen(function* () {
    const toolkit = yield* Tools;

    const model = yield* OpenRouterLanguageModel.model("anthropic/claude-haiku-4.5");

    const answer = Effect.fn("Assistant.answer")(
      function* (question: string) {
        const { text, toolCalls } = yield* LanguageModel.generateText({
          prompt: question,
          toolkit,
        });

        return {
          text,
          toolCalls,
        };
      },

      Effect.provide(model),

      Effect.catchTag(
        "AiError",
        (error) =>
          Effect.fail(
            new AssistantError({
              reason: error.reason,
            }),
          ),

        (error) => Effect.die(error),
      ),
    );

    return Assistant.of({ answer });
  }),
);
