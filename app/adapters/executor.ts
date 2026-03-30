import { OpenRouterLanguageModel } from "@effect/ai-openrouter";
import { Array, Effect, Layer, Match, Option, Ref, Result, Stream } from "effect";
import { Chat, Prompt as AiPrompt } from "effect/unstable/ai";

import { ExecutorError } from "../domain/errors/executor.ts";
import { Prompt, TokenCount, ToolCallId, ToolName, ToolOutput } from "../domain/models/primitives.ts";
import { ReasoningDelta, TextDelta, ToolCall, ToolResult, type TurnEvent, Usage } from "../domain/models/turn-event.ts";
import { Executor, type ExecutorShape, type ExecutorStreamResult } from "../ports/executor.ts";
import { AgentExecutorTools, AgentExecutorToolsService } from "./services/agent-executor-tools.ts";
import { ProviderService } from "./services/provider.ts";

const SYSTEM_MESSAGE = {
  role: "system" as const,
  content: "You are a helpful assistant specialized in coding.",
};

const makeImpl = Effect.gen(function*() {
  const chatPersistence = yield* Chat.Persistence;
  const toolkit = yield* AgentExecutorTools;
  const model = yield* OpenRouterLanguageModel.model("nvidia/nemotron-3-super-120b-a12b:free");

  const initializeChat = Effect.fn("executor.initializeChat")(function*(chat: Chat.Persisted) {
    const currentHistory = yield* Ref.get(chat.history);

    if (currentHistory.content.length > 0) {
      return;
    }

    yield* Ref.set(chat.history, AiPrompt.make([SYSTEM_MESSAGE]));
    yield* chat.save.pipe(
      Effect.mapError((cause) => new ExecutorError({ cause })),
    );
  });

  const stream: ExecutorShape["stream"] = Effect.fn("executor.stream")(
    function*({ prompt, sessionId }): Effect.fn.Return<ExecutorStreamResult, ExecutorError> {
      const chat = yield* chatPersistence.get(sessionId).pipe(
        Effect.mapError((cause) => new ExecutorError({ cause })),
      );

      yield* initializeChat(chat);

      const runLoop = Effect.fn("executor.handleTurn")(
        function*(
          { prompt: turnPrompt }: { prompt: string },
        ): Effect.fn.Return<Stream.Stream<TurnEvent, ExecutorError>> {
          const eventStream = chat.streamText({ prompt: turnPrompt, toolkit }).pipe(Stream.provide(model));

          return eventStream.pipe(
            Stream.filterMap((part) =>
              Match.value(part).pipe(
                Match.when({ type: "text-delta" }, ({ delta }) => Result.succeed(new TextDelta({ delta }))),
                Match.when({ type: "reasoning-delta" }, ({ delta }) => Result.succeed(new ReasoningDelta({ delta }))),
                Match.when({ type: "tool-call" }, ({ name, id }) =>
                  Result.succeed(new ToolCall({ name: name as ToolName, id: id as ToolCallId }))),
                Match.when({ type: "tool-result" }, ({ name, id, result, isFailure }) =>
                  Result.succeed(
                    new ToolResult({
                      name: ToolName.makeUnsafe(name),
                      id: ToolCallId.makeUnsafe(id),
                      output: ToolOutput.makeUnsafe(String(result)),
                      isFailure,
                    }),
                  )),
                Match.when({ type: "finish" }, ({ usage: { inputTokens, outputTokens } }) =>
                  Result.succeed(
                    new Usage({
                      inputTokens: TokenCount.makeUnsafe(inputTokens.total ?? 0),
                      outputTokens: TokenCount.makeUnsafe(outputTokens.total ?? 0),
                    }),
                  )),
                Match.orElse(() =>
                  Result.failVoid
                ),
              )
            ),
            Stream.tap((event) => Effect.logDebug("Executor event", { event })),
            Stream.concat(
              Stream.unwrap(
                Effect.gen(function*() {
                  const currentHistory = yield* Ref.get(chat.history);

                  const lastAssistantPart = Array.findLast(currentHistory.content, (part) => part.role === "assistant");

                  if (Option.isSome(lastAssistantPart)) {
                    const hasToolCall = Array.findLast(
                      lastAssistantPart.value.content,
                      (part) => part.type === "tool-call",
                    );

                    if (Option.isSome(hasToolCall)) {
                      return yield* runLoop({ prompt: "" });
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

      const events = yield* runLoop({ prompt: Prompt.makeUnsafe(prompt) });

      return { events };
    },
  );

  return Executor.of({ stream });
}).pipe(Effect.provide(AgentExecutorToolsService), Effect.provide(ProviderService));

export const ExecutorAdapter = Layer.effect(Executor, makeImpl);
