import { OpenRouterLanguageModel } from "@effect/ai-openrouter";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";
import * as LanguageModel from "effect/unstable/ai/LanguageModel";
import * as Prompt from "effect/unstable/ai/Prompt";
import type * as Response from "effect/unstable/ai/Response";

import {
  AgentExecutor,
  AgentExecutorError,
  AgentExecutorAssistantTextEvent,
  AgentExecutorCompletionEvent,
  type AgentExecutorEvent,
  AgentExecutorToolCallEvent,
  AgentExecutorToolFailureEvent,
  AgentExecutorToolResultEvent,
} from "../ports/agent-executor.ts";
import {
  AgentExecutorToolRuntime,
  AgentExecutorToolRuntimeService,
  AgentExecutorTools,
} from "./services/agent-executor-tools.ts";
import type { ToolkitError } from "./services/agent-executor-tools.ts";

const TOOL_OUTPUT_LIMIT = 2_000;

const normalizeToolOutput = (
  output: string | void,
): { output: string | null; truncated: boolean } => {
  if (typeof output !== "string") {
    return {
      output: null,
      truncated: false,
    };
  }

  if (output.length <= TOOL_OUTPUT_LIMIT) {
    return {
      output,
      truncated: false,
    };
  }

  return {
    output: `${output.slice(0, TOOL_OUTPUT_LIMIT)}\n...[truncated]`,
    truncated: true,
  };
};

const serializeToolInput = (input: unknown) => JSON.stringify(input);

const makeImpl = Effect.gen(function*() {
  const runtime = yield* AgentExecutorToolRuntime;
  const model = yield* OpenRouterLanguageModel.model("anthropic/claude-haiku-4.5");

  const executeTurn: AgentExecutor["Service"]["executeTurn"] = ({ prompt }) =>
    Effect.gen(function*() {
      const ai = yield* LanguageModel.LanguageModel;

      yield* Effect.logDebug("Executing agent turn");

      const events: Array<AgentExecutorEvent> = [];
      // oxlint-disable-next-line typescript/no-explicit-any
      const response: Array<Response.StreamPart<any>> = [];
      let completionSummary: string | null = null;

      const pushEvent = (event: AgentExecutorEvent) =>
        Effect.sync(() => {
          events.push(event);
        });

      const instrumentTool = <TInput extends object, TOutput>(
        toolName: string,
        execute: (input: TInput) => Effect.Effect<TOutput, ToolkitError, never>,
      ) =>
        Effect.fn(`tool.${toolName}`)(
          function*(input: TInput) {
            const startedAt = Date.now();

            yield* pushEvent(new AgentExecutorToolCallEvent({
              toolName,
              input: serializeToolInput(input),
            }));

            return yield* execute(input).pipe(
              Effect.tap((result) => {
                const normalized = normalizeToolOutput(
                  typeof result === "string" ? result : undefined,
                );

                return pushEvent(new AgentExecutorToolResultEvent({
                  toolName,
                  output: normalized.output,
                  durationMs: Date.now() - startedAt,
                  truncated: normalized.truncated,
                }));
              }),
              Effect.tapError((error) =>
                pushEvent(new AgentExecutorToolFailureEvent({
                  toolName,
                  message: error.message,
                  durationMs: Date.now() - startedAt,
                  truncated: false,
                })),
              ),
            );
          },
        );

      const completeTask = Effect.fn("tool.completeTask")(
        function*({ summary }: { summary: string }) {
          const startedAt = Date.now();

          yield* pushEvent(new AgentExecutorToolCallEvent({
            toolName: "completeTask",
            input: serializeToolInput({ summary }),
          }));

          completionSummary = summary;

          yield* pushEvent(new AgentExecutorToolResultEvent({
            toolName: "completeTask",
            output: null,
            durationMs: Date.now() - startedAt,
            truncated: false,
          }));
        },
      );

      const toolkitHandlers = AgentExecutorTools.of({
        readFile: instrumentTool("readFile", runtime.readFile),
        writeFile: instrumentTool("writeFile", runtime.writeFile),
        bash: instrumentTool("bash", runtime.bash),
        completeTask,
      });

      const toolkit = yield* AgentExecutorTools.asEffect().pipe(
        Effect.provide(AgentExecutorTools.toLayer(toolkitHandlers)),
      );

      yield* ai.streamText({ prompt, toolkit }).pipe(
        Stream.runForEachArray((parts) => Effect.sync(() => {
          response.push(...parts);
        })),
      );

      const nextPrompt = pipe(
        prompt,
        Prompt.concat(Prompt.fromResponseParts(response)),
      );

      const text = response
        .filter((part): part is Extract<Response.StreamPart<any>, { type: "text-delta" }> => part.type === "text-delta")
        .map((part) => part.delta)
        .join("");

      if (text.trim().length > 0) {
        yield* pushEvent(new AgentExecutorAssistantTextEvent({ text }));
      }

      if (completionSummary !== null) {
        yield* pushEvent(new AgentExecutorCompletionEvent({
          summary: completionSummary,
          status: "completed",
        }));
      }

      return {
        prompt: nextPrompt,
        events,
      };
    }).pipe(
      Effect.provide(model),
      Effect.catch((cause) => Effect.fail(new AgentExecutorError({ message: "Failed to execute turn", cause }))),
    );

  return AgentExecutor.of({ executeTurn });
}).pipe(Effect.provide(AgentExecutorToolRuntimeService));

export const AgentExecutorAdapter = Layer.effect(AgentExecutor, makeImpl);
