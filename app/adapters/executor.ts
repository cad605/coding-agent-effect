import { OpenRouterLanguageModel } from "@effect/ai-openrouter";
import { Array, Effect, Layer, Match, Option, Ref, Result, Stream } from "effect";
import { Chat } from "effect/unstable/ai";

import { ExecutorError } from "../domain/errors/executor.ts";
import { Prompt, TokenCount, ToolCallId, ToolName, ToolOutput } from "../domain/models/primitives.ts";
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

  const runLoop = Effect.fn("executor.handleTurn")(
    function*({ prompt }: { prompt: string }): Effect.fn.Return<Stream.Stream<TurnEvent, ExecutorError>> {
      const stream = chat.streamText({ prompt, toolkit }).pipe(Stream.provide(model));

      return stream.pipe(
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
            Match.orElse(() => Result.failVoid),
          )
        ),
        Stream.tap((event) => Effect.logDebug("Executor event", { event })),
        Stream.concat(
          Stream.unwrap(
            Effect.gen(function*() {
              const history = yield* Ref.get(chat.history);

              const lastAssistantPart = Array.findLast(history.content, (part) => part.role === "assistant");

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

  const stream: ExecutorShape["stream"] = Effect.fn("executor.stream")(
    function*({ prompt }) {
      return yield* runLoop({ prompt: Prompt.makeUnsafe(prompt) });
    },
  );

  return Executor.of({ stream });
}).pipe(Effect.provide(AgentExecutorToolsService), Effect.provide(ProviderService));

export const ExecutorAdapter = Layer.effect(Executor, makeImpl);
