import { OpenRouterLanguageModel } from "@effect/ai-openrouter";
import { Array, Effect, Layer, Match, Option, Ref, Result, Stream } from "effect";
import { Chat } from "effect/unstable/ai";

import { ExecutorError } from "../domain/errors/executor.ts";
import { ReasoningDelta, TextDelta, ToolCall, ToolResult, type TurnEvent, Usage } from "../domain/models/turn-event.ts";
import { Executor, type ExecutorShape } from "../ports/executor.ts";
import { AgentExecutorTools, AgentExecutorToolsService } from "./services/agent-executor-tools.ts";
import { ProviderService } from "./services/provider.ts";

const makeImpl = Effect.gen(function*() {
  const toolkit = yield* AgentExecutorTools;
  const model = yield* OpenRouterLanguageModel.model("anthropic/claude-haiku-4.5");

  const chat = yield* Chat.fromPrompt([{
    role: "system",
    content: "You are a helpful assistant specialized in coding.",
  }]);

  const handleTurn = Effect.fn("executor.handleTurn")(
    function*({ prompt }: { prompt: string }): Effect.fn.Return<Stream.Stream<TurnEvent, ExecutorError>> {
      const stream = chat.streamText({ prompt, toolkit }).pipe(Stream.provide(model));

      return stream.pipe(
        Stream.filterMap((part) =>
          Match.value(part).pipe(
            Match.when({ type: "text-delta" }, (p) => Result.succeed(new TextDelta({ delta: p.delta }))),
            Match.when({ type: "reasoning-delta" }, (p) => Result.succeed(new ReasoningDelta({ delta: p.delta }))),
            Match.when({ type: "tool-call" }, (p) => Result.succeed(new ToolCall({ name: p.name, id: p.id }))),
            Match.when({ type: "tool-result" }, (p) =>
              Result.succeed(
                new ToolResult({ name: p.name, id: p.id, output: String(p.result), isFailure: p.isFailure }),
              )),
            Match.when({ type: "finish" }, (p) =>
              Result.succeed(
                new Usage({
                  inputTokens: p.usage.inputTokens.total ?? 0,
                  outputTokens: p.usage.outputTokens.total ?? 0,
                }),
              )),
            Match.orElse(() => Result.failVoid),
          )
        ),
        Stream.concat(
          Stream.unwrap(
            Effect.gen(function*() {
              const history = yield* Ref.get(chat.history);

              const lastAssistantPart = Array.findLast(history.content, (part) => part.role === "assistant");

              if (Option.isSome(lastAssistantPart)) {
                const hasToolCall = Option.fromNullOr(
                  Array.findLast(lastAssistantPart.value.content, (part) => part.type === "tool-call"),
                );

                if (Option.isSome(hasToolCall)) {
                  return yield* handleTurn({ prompt: "" });
                }
              }

              return Stream.empty;
            }),
          ),
        ),
        Stream.mapError((cause) => new ExecutorError({ cause })),
      );
    },
  );

  const stream: ExecutorShape["stream"] = Effect.fn("executor.stream")(
    function*({ prompt }) {
      return yield* handleTurn({ prompt });
    },
  );

  return Executor.of({ stream });
}).pipe(Effect.provide(AgentExecutorToolsService), Effect.provide(ProviderService));

export const ExecutorAdapter = Layer.effect(Executor, makeImpl);
