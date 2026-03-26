import { OpenRouterLanguageModel } from "@effect/ai-openrouter";
import { Effect, Layer, Ref, Stream } from "effect";
import { Chat, Prompt } from "effect/unstable/ai";

import { AgentExecutorError, ModelTurnFailed } from "../domain/errors/agent-executor.ts";
import {
  ReasoningDelta,
  ReasoningEnd,
  TextDelta,
  TextEnd,
  ToolCallStart,
  ToolResult,
  TurnComplete,
  type TurnEvent,
  UsageReport,
} from "../domain/models/agent-executor.ts";
import { AgentExecutor, type AgentExecutorShape } from "../ports/agent-executor.ts";
import { AgentExecutorTools, AgentExecutorToolsService } from "./services/agent-executor-tools.ts";
import { ProviderService } from "./services/provider.ts";

const makeImpl = Effect.gen(function*() {
  const toolkit = yield* AgentExecutorTools;
  const model = yield* OpenRouterLanguageModel.model("anthropic/claude-haiku-4.5");

  const primary = yield* Chat.fromPrompt(Prompt.empty);

  const createExecutor = (chat: Chat.Service): AgentExecutorShape => ({
    streamTurn: Effect.fn("agent-executor.streamTurn")(
      function*(options) {
        if (options.systemPrompt) {
          yield* Ref.update(chat.history, Prompt.setSystem(options.systemPrompt));
        }

        const prompt = options.userMessage ?? [];

        let text = "";
        let hadToolCall = false;

        return chat.streamText({ prompt, toolkit }).pipe(
          Stream.flatMap((part) => {
            const events: Array<TurnEvent> = [];
            switch (part.type) {
              case "text-delta":
                text += part.delta;
                events.push(new TextDelta({ delta: part.delta }));
                break;
              case "text-end":
                events.push(new TextEnd());
                break;
              case "reasoning-delta":
                text += part.delta;
                events.push(new ReasoningDelta({ delta: part.delta }));
                break;
              case "reasoning-end":
                events.push(new ReasoningEnd());
                break;
              case "tool-call":
                hadToolCall = true;
                events.push(new ToolCallStart({ toolName: part.name, toolCallId: part.id }));
                break;
              case "tool-result":
                events.push(
                  new ToolResult({
                    toolName: part.name,
                    toolCallId: part.id,
                    output: String(part.result),
                    isFailure: part.isFailure,
                  }),
                );
                break;
              case "finish":
                events.push(
                  new UsageReport({
                    inputTokens: part.usage.inputTokens.total ?? 0,
                    outputTokens: part.usage.outputTokens.total ?? 0,
                  }),
                );
                break;
            }
            return Stream.fromIterable(events);
          }),
          Stream.concat(Stream.suspend(() => Stream.make(new TurnComplete({ hadToolCall, text })))),
        );
      },
      Stream.unwrap,
      (stream) =>
        stream.pipe(
          Stream.provide(model),
          Stream.catch((cause) => Stream.fail(new AgentExecutorError({ reason: new ModelTurnFailed({ cause }) }))),
        ),
    ),

    fork: Effect.fn(function*() {
      const subChat = yield* Chat.empty;
      return createExecutor(subChat);
    }, Effect.mapError((cause) => new AgentExecutorError({ reason: new ModelTurnFailed({ cause }) }))),

    exportJson: chat.exportJson.pipe(
      Effect.mapError((cause) => new AgentExecutorError({ reason: new ModelTurnFailed({ cause }) })),
    ),
  });

  
  return AgentExecutor.of(createExecutor(primary));
}).pipe(Effect.provide(AgentExecutorToolsService), Effect.provide(ProviderService));

export const AgentExecutorAdapter = Layer.effect(AgentExecutor, makeImpl);
