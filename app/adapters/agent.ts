import { OpenRouterLanguageModel } from "@effect/ai-openrouter";
import { Effect, Layer } from "effect";
import { Chat } from "effect/unstable/ai";

import { Agent, AgentError } from "../ports/agent.ts";
import { Tools } from "../ports/tools.ts";

export const AgentLive = Layer.effect(
  Agent,
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
          {
            role: "user",
            content: [{ type: "text", text: prompt }]
          },
        ]);

        while (true) {
          const { text, finishReason} = yield* session.generateText({
            prompt: [],
            toolkit,
          });

          if (finishReason !== "stop") {
            continue;
          }

          return text;
        }
      },

      Effect.provide(model),

      Effect.catchTag(
        "AiError",
        (error) =>
          Effect.fail(
            new AgentError({
              reason: error.reason,
            }),
          ),

        (error) => Effect.die(error),
      ),
    );

    return Agent.of({ answer });
  }),
);
