import { OpenRouterLanguageModel } from "@effect/ai-openrouter";
import { Effect, Layer } from "effect";
import { Chat } from "effect/unstable/ai";

import { Agent, AgentError } from "../ports/agent.ts";
import { Tools } from "../ports/tools.ts";

export const AgentLive = Layer.effect(
  Agent,
  Effect.gen(function* () {
    const model = yield* OpenRouterLanguageModel.model("anthropic/claude-haiku-4.5");

    const tools = yield* Tools;

    const answer = Effect.fn("agent.answer")(
      function* (content: string) {
        const session = yield* Chat.fromPrompt([
          {
            role: "system",
            content: "You are a helpful assistant specialized in coding.",
          },
          {
            role: "user",
            content,
          },
        ]);

        while (true) {
          const { text, toolCalls } = yield* session
            .generateText({
              prompt: [],
              toolkit: tools,
            })
            .pipe(Effect.provide(model));

          if (toolCalls.length > 0) {
            continue;
          }

          return text;
        }
      },

      Effect.catchTag(
        "AiError",
        (error) => Effect.fail(AgentError.fromAiError(error)),
        (e) => Effect.die(e),
      ),
    );

    return Agent.of({ answer });
  }),
);
