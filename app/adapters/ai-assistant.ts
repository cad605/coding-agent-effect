import { OpenRouterLanguageModel } from "@effect/ai-openrouter";
import { Effect, Layer } from "effect";
import { Chat } from "effect/unstable/ai";

import { Assistant, AssistantError } from "../ports/assistant.ts";
import { Tools } from "../ports/tools.ts";

export const AiAssistantLive = Layer.effect(
  Assistant,
  Effect.gen(function* () {
    const toolkit = yield* Tools;

    const model = yield* OpenRouterLanguageModel.model("anthropic/claude-haiku-4.5");

    const answer = Effect.fn("Assistant.answer")(
      function* (prompt: string) {
        const session = yield* Chat.fromPrompt([
          {
            role: "system",
            content: "You are a helpful assistant specialized in coding.",
          },
        ]);

        while (true) {
          const response = yield* session.generateText({
            prompt,
            toolkit,
          });

          if (response.finishReason !== "stop") {
            continue;
          }

          return response.text;
        }
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
