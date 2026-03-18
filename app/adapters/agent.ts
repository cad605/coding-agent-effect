import { OpenRouterLanguageModel } from "@effect/ai-openrouter";
import { Effect, Layer } from "effect";
import { Chat } from "effect/unstable/ai";

import { Agent, AgentError } from "../ports/agent.ts";
import { Tools } from "../ports/tools.ts";

export const AgentLive = Layer.effect(
  Agent,
  Effect.gen(function* () {
    yield* Effect.logDebug("Initializing agent...");

    const model = yield* OpenRouterLanguageModel.model("anthropic/claude-haiku-4.5");

    const tools = yield* Tools;

    const act = Effect.fn("agent.act")(
      function* (prompt: string) {
        yield* Effect.logDebug("Starting new session...", { prompt });

        const session = yield* Chat.fromPrompt([
          {
            role: "system",
            content: "You are a helpful assistant specialized in coding.",
          },
          {
            role: "user",
            content: prompt,
          },
        ]);

        while (true) {
          yield* Effect.logDebug("Generating text...");

          const { text, toolCalls } = yield* session
            .generateText({
              prompt: [],
              toolkit: tools,
            })
            .pipe(Effect.provide(model));

          if (toolCalls.length > 0) {
            yield* Effect.logDebug("Continuing with tool calls...", { toolCalls });

            continue;
          }

          yield* Effect.logDebug("Returning final response...", { text });

          return text;
        }
      },

      Effect.catchTag(
        "AiError",
        (error) => Effect.fail(AgentError.fromAiError(error)),
        (e) => Effect.die(e),
      ),
    );

    return Agent.of({ act });
  }),
);
