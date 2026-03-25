import { OpenRouterLanguageModel } from "@effect/ai-openrouter";
import { Effect, Layer } from "effect";
import { Chat } from "effect/unstable/ai";

import { AgentExecutor, AgentExecutorError } from "../ports/agent-executor.ts";
import { AgentExecutorTools, AgentExecutorToolsService } from "./services/agent-executor-tools.ts";

const makeImpl = Effect.gen(function*() {
  const toolkit = yield* AgentExecutorTools;
  const model = yield* OpenRouterLanguageModel.model("anthropic/claude-haiku-4.5");

  const generateResponse = Effect.fn("agentExecutor.generateResponse")(
    function*({ prompt }: { prompt: string }) {
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
        yield* Effect.logDebug("Generating text");

        const { text, toolCalls } = yield* session
          .generateText({
            prompt: [],
            toolkit,
          })
          .pipe(Effect.provide(model));

        if (toolCalls.length > 0) {
          yield* Effect.logDebug("Continuing with tool calls", { toolCalls });

          continue;
        }

        return text;
      }
    },
    Effect.catch((cause) => Effect.fail(new AgentExecutorError({ message: "Failed to generate response", cause }))),
  );

  return AgentExecutor.of({ generateResponse });
}).pipe(Effect.provide(AgentExecutorToolsService));

export const AgentExecutorAdapter = Layer.effect(AgentExecutor, makeImpl);
