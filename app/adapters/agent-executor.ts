import { OpenRouterLanguageModel } from "@effect/ai-openrouter";
import { Effect, Layer, Match, Stream } from "effect";
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
import { AgentExecutorTools, AgentExecutorToolsService } from "./services/agent-executor-tools.ts";
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

      const matchType = Match.discriminator("type");

      return LanguageModel.streamText({ prompt, toolkit }).pipe(
        Stream.flatMap((part) => {
          responseParts.push(part);

          const events = Match.value(part).pipe(
            matchType("text-delta", "reasoning-delta", (p): Array<TurnEvent> => {
              text += p.delta;
              return [new TextDelta({ delta: p.delta })];
            }),
            matchType("tool-call", (p) => {
              hadToolCall = true;
              return [new ToolCallStart({ toolName: p.name, toolCallId: p.id })];
            }),
            matchType("tool-result", (p) => [
              new ToolResult({
                toolName: p.name,
                toolCallId: p.id,
                output: String(p.result),
                isFailure: p.isFailure,
              }),
            ]),
            matchType("finish", (p) => [
              new UsageReport({
                inputTokens: p.usage.inputTokens.total ?? 0,
                outputTokens: p.usage.outputTokens.total ?? 0,
              }),
            ]),
            Match.orElse(() => []),
          );

          return Stream.fromIterable(events);
        }),
        Stream.concat(Stream.suspend(() =>
          Stream.make(
            new TurnComplete({
              hadToolCall,
              text,
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
        Stream.tapError((cause) => Effect.logError("Agent executor error", { cause: JSON.stringify(cause, null, 2) })),
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
