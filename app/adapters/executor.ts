import { OpenRouterLanguageModel } from "@effect/ai-openrouter";
import { Effect, Layer, Match, Stream } from "effect";
import { Chat } from "effect/unstable/ai";

import { ExecutorError } from "../domain/errors/executor.ts";
import { Ignored, ReasoningDelta, ReasoningEnd, TextDelta, TextEnd } from "../domain/models/turn-event.ts";
import { Executor, type ExecutorShape } from "../ports/executor.ts";
import { AgentExecutorTools, AgentExecutorToolsService } from "./services/agent-executor-tools.ts";
import { ProviderService } from "./services/provider.ts";

const makeImpl = Effect.gen(function*() {
  const toolkit = yield* AgentExecutorTools;
  const model = yield* OpenRouterLanguageModel.model("anthropic/claude-haiku-4.5");

  const chat = yield* Chat.empty;

  const stream: ExecutorShape["stream"] = Effect.fn("executor.stream")(
    function*({ prompt }) {
      return chat.streamText({ prompt, toolkit }).pipe(
        Stream.provide(model),
        Stream.map((part) =>
          Match.value(part).pipe(
            Match.when({ type: "text-delta" }, ({ delta }) => new TextDelta({ delta })),
            Match.when({ type: "text-end" }, () => new TextEnd()),
            Match.when({ type: "reasoning-delta" }, ({ delta }) => new ReasoningDelta({ delta })),
            Match.when({ type: "reasoning-end" }, () => new ReasoningEnd()),
            Match.orElse(() => new Ignored()),
          )
        ),
        Stream.catch((cause) => Stream.fail(new ExecutorError({ cause }))),
      );
    },
  );

  return Executor.of({ stream });
}).pipe(Effect.provide(AgentExecutorToolsService), Effect.provide(ProviderService));

export const ExecutorAdapter = Layer.effect(Executor, makeImpl);
