import { OpenRouterLanguageModel } from "@effect/ai-openrouter";
import { Effect, Layer, Stream } from "effect";
import { LanguageModel, Prompt, type Response } from "effect/unstable/ai";

import { AgentExecutorError, ModelTurnFailed } from "../domain/errors/agent-executor.ts";
import {
  TextDelta,
  ToolCallStart,
  ToolResult,
  TurnComplete,
  type TurnEvent,
  UsageReport,
} from "../domain/models/agent-executor.ts";
import { AgentExecutor } from "../ports/agent-executor.ts";
import type { AgentExecutorShape } from "../ports/agent-executor.ts";
import { AgentExecutorTools, AgentExecutorToolsService, CompleteTaskResult } from "./services/agent-executor-tools.ts";
import { ProviderService } from "./services/provider.ts";

const makeImpl = Effect.gen(function*() {
  const toolkit = yield* AgentExecutorTools;
  const model = yield* OpenRouterLanguageModel.model("anthropic/claude-haiku-4.5");

  const executeTurn: AgentExecutorShape["executeTurn"] = Effect.fn("agent-executor.executeTurn")(
    function*(prompt) {
      yield* Effect.logDebug("Executing agent turn");

      const responseParts: Array<Response.AnyPart> = [];
      let text = "";
      let hadToolCall = false;
      let completionSummary: string | null = null;

      return LanguageModel.streamText({ prompt, toolkit }).pipe(
        Stream.flatMap((part) => {
          responseParts.push(part);
          const events: Array<TurnEvent> = [];

          switch (part.type) {
            case "text-delta":
            case "reasoning-delta":
              text += part.delta;
              events.push(new TextDelta({ delta: part.delta }));
              break;
            case "tool-call":
              hadToolCall = true;
              events.push(new ToolCallStart({ toolName: part.name, toolCallId: part.id }));
              break;
            case "tool-result":
              if (!part.preliminary) {
                if (part.result instanceof CompleteTaskResult) {
                  completionSummary = part.result.summary;
                }
                events.push(
                  new ToolResult({
                    toolName: part.name,
                    toolCallId: part.id,
                    output: String(part.result),
                    isFailure: part.isFailure,
                  }),
                );
              }
              break;
            case "finish": {
              const usage = part.usage;
              events.push(
                new UsageReport({
                  inputTokens: usage.inputTokens.total ?? 0,
                  outputTokens: usage.outputTokens.total ?? 0,
                }),
              );
              break;
            }
          }

          return Stream.fromIterable(events);
        }),
        Stream.concat(Stream.suspend(() =>
          Stream.make(
            new TurnComplete({
              hadToolCall,
              text,
              completionSummary,
              promptDelta: Prompt.fromResponseParts(responseParts),
            }),
          )
        )),
      );
    },
    Stream.unwrap,
    (stream) =>
      stream.pipe(
        Stream.provide(model),
        Stream.catch((cause) =>
          Stream.fail(
            new AgentExecutorError({
              reason: new ModelTurnFailed({ cause }),
            }),
          )
        ),
      ),
  );

  return AgentExecutor.of({ executeTurn }) satisfies AgentExecutorShape;
}).pipe(Effect.provide(AgentExecutorToolsService), Effect.provide(ProviderService));

export const AgentExecutorAdapter = Layer.effect(AgentExecutor, makeImpl);
