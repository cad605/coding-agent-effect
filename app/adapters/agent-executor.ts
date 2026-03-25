import { OpenRouterLanguageModel } from "@effect/ai-openrouter";
import { Effect, Layer, Stream } from "effect";
import { LanguageModel, Prompt, type Response } from "effect/unstable/ai";

import {
  AgentExecutorError,
  ModelTurnFailed,
  ToolRuntimeFailed,
  UnsupportedRuntimeMessage,
  UnsupportedRuntimePart,
} from "../domain/errors/agent-executor.ts";
import {
  AgentExecutorAssistantTextEvent,
  AgentExecutorCompletionEvent,
  type AgentExecutorEvent,
  AgentExecutorToolCallEvent,
  AgentExecutorToolFailureEvent,
  AgentExecutorToolResultEvent,
  type AgentExecutorTurnInput,
  AgentExecutorTurnResult,
} from "../domain/models/agent-executor.ts";
import {
  AgentRunAssistantMessage,
  type AgentRunAssistantPart,
  type AgentRunMessage,
  AgentRunReasoningPart,
  type AgentRunState,
  AgentRunTextPart,
  AgentRunToolCallPart,
  AgentRunToolMessage,
  AgentRunToolResultPart,
} from "../domain/models/agent-run.ts";
import { AgentExecutor } from "../ports/agent-executor.ts";
import type { AgentExecutorShape } from "../ports/agent-executor.ts";
import {
  AgentExecutorToolRuntime,
  AgentExecutorToolRuntimeService,
  AgentExecutorTools,
  CompleteTaskResult,
} from "./services/agent-executor-tools.ts";
import type { ToolkitError } from "./services/agent-executor-tools.ts";
import { ProviderService } from "./services/provider.ts";

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

const unsupportedMessage = (role: string) =>
  new AgentExecutorError({
    reason: new UnsupportedRuntimeMessage({ role }),
  });

const unsupportedPart = (type: string) =>
  new AgentExecutorError({
    reason: new UnsupportedRuntimePart({ partType: type }),
  });

const toToolName = (error: ToolkitError): string => {
  switch (error.reason._tag) {
    case "ReadFileFailed":
      return "readFile";
    case "WriteFileFailed":
      return "writeFile";
    case "CommandFailed":
      return "bash";
  }
};

const toolRuntimeFailed = (error: ToolkitError) =>
  new AgentExecutorError({
    reason: new ToolRuntimeFailed({
      toolName: toToolName(error),
      message: error.message,
    }),
  });

const modelTurnFailed = (cause: unknown) =>
  new AgentExecutorError({
    reason: new ModelTurnFailed({ cause }),
  });

const toPromptAssistantPart = (
  part: AgentRunAssistantPart,
): Prompt.AssistantMessagePartEncoded => {
  switch (part.type) {
    case "text":
      return {
        type: "text",
        text: part.text,
      };
    case "reasoning":
      return {
        type: "reasoning",
        text: part.text,
      };
    case "tool-call":
      return {
        type: "tool-call",
        id: part.id,
        name: part.name,
        params: part.params,
        providerExecuted: part.providerExecuted,
      };
    case "tool-result":
      return {
        type: "tool-result",
        id: part.id,
        name: part.name,
        isFailure: part.isFailure,
        result: part.result,
      };
  }
};

const toPromptMessage = (
  message: AgentRunMessage,
): Prompt.MessageEncoded => {
  switch (message.role) {
    case "system":
      return {
        role: "system",
        content: message.content,
      };
    case "user":
      return {
        role: "user",
        content: message.content,
      };
    case "assistant":
      return {
        role: "assistant",
        content: message.content.map(toPromptAssistantPart),
      };
    case "tool":
      return {
        role: "tool",
        content: message.content.map((part) => ({
          type: "tool-result",
          id: part.id,
          name: part.name,
          isFailure: part.isFailure,
          result: part.result,
        })),
      };
  }
};

const buildPrompt = (run: AgentRunState) => Prompt.make(run.messages.map(toPromptMessage));

const toCompletionEvent = (
  messages: ReadonlyArray<AgentRunMessage>,
): AgentExecutorCompletionEvent | null => {
  for (const message of messages) {
    if (message.role !== "tool") {
      continue;
    }

    for (const part of message.content) {
      if (
        part.name === "completeTask"
        && part.isFailure === false
        && typeof part.result === "object"
        && part.result !== null
        && "summary" in part.result
        && "status" in part.result
        && typeof part.result.summary === "string"
        && part.result.status === "completed"
      ) {
        return new AgentExecutorCompletionEvent({
          summary: part.result.summary,
          status: "completed",
        });
      }
    }
  }

  return null;
};

const fromAssistantPart = (
  part: Prompt.AssistantMessagePart,
): Effect.Effect<AgentRunAssistantPart, AgentExecutorError, never> => {
  switch (part.type) {
    case "text":
      return Effect.succeed(
        new AgentRunTextPart({
          type: "text",
          text: part.text,
        }),
      );
    case "reasoning":
      return Effect.succeed(
        new AgentRunReasoningPart({
          type: "reasoning",
          text: part.text,
        }),
      );
    case "tool-call":
      return Effect.succeed(
        new AgentRunToolCallPart({
          type: "tool-call",
          id: part.id,
          name: part.name,
          params: part.params,
          providerExecuted: part.providerExecuted,
        }),
      );
    case "tool-result":
      return Effect.succeed(
        new AgentRunToolResultPart({
          type: "tool-result",
          id: part.id,
          name: part.name,
          isFailure: part.isFailure,
          result: part.result,
        }),
      );
    default:
      return Effect.fail(unsupportedPart(part.type));
  }
};

const fromPromptMessage = (
  message: Prompt.Message,
): Effect.Effect<AgentRunMessage, AgentExecutorError, never> => {
  switch (message.role) {
    case "assistant":
      return Effect.forEach(message.content, fromAssistantPart).pipe(
        Effect.map((content) =>
          new AgentRunAssistantMessage({
            role: "assistant",
            content,
          })
        ),
      );
    case "tool":
      return Effect.forEach(message.content, (part) => {
        if (part.type !== "tool-result") {
          return Effect.fail(unsupportedPart(part.type));
        }

        return Effect.succeed(
          new AgentRunToolResultPart({
            type: "tool-result",
            id: part.id,
            name: part.name,
            isFailure: part.isFailure,
            result: part.result,
          }),
        );
      }).pipe(
        Effect.map((content) =>
          new AgentRunToolMessage({
            role: "tool",
            content,
          })
        ),
      );
    default:
      return Effect.fail(unsupportedMessage(message.role));
  }
};

const makeImpl = Effect.gen(function*() {
  const runtime = yield* AgentExecutorToolRuntime;
  const model = yield* OpenRouterLanguageModel.model("anthropic/claude-haiku-4.5");

  const executeTurn: AgentExecutorShape["executeTurn"] = Effect.fn("agent-executor.executeTurn")(
    function*({ run }: AgentExecutorTurnInput) {
      const ai = yield* LanguageModel.LanguageModel;

      yield* Effect.logDebug("Executing agent turn");

      const events: Array<AgentExecutorEvent> = [];
      const response: Array<Response.AnyPart> = [];

      const pushEvent = (event: AgentExecutorEvent) =>
        Effect.sync(() => { events.push(event); });

      const instrumentTool = <TInput extends object, TOutput>(
        { toolName, execute }: {
          toolName: string;
          execute: (input: TInput) => Effect.Effect<TOutput, ToolkitError, never>;
        },
      ) =>
        Effect.fn(`tool.${toolName}`)(
          function*(input: TInput) {
            yield* pushEvent(
              new AgentExecutorToolCallEvent({
                toolName,
                input: serializeToolInput(input),
              }),
            );

            return yield* execute(input).pipe(
              Effect.tap((result) => {
                const normalized = normalizeToolOutput(
                  typeof result === "string" ? result : undefined,
                );

                return pushEvent(
                  new AgentExecutorToolResultEvent({
                    toolName,
                    output: normalized.output,
                    truncated: normalized.truncated,
                  }),
                )
              }),
              Effect.tapError((error) =>
                pushEvent(
                  new AgentExecutorToolFailureEvent({
                    toolName,
                    message: error.message,
                    truncated: false,
                  }),
                )
              ),
            );
          },
        );

      const completeTask = Effect.fn("tool.completeTask")(
        function*({ summary }: { summary: string }) {
          yield* pushEvent(
            new AgentExecutorToolCallEvent({
              toolName: "completeTask",
              input: serializeToolInput({ summary }),
            }),
          );

          yield* pushEvent(
            new AgentExecutorToolResultEvent({
              toolName: "completeTask",
              output: null,
              truncated: false,
            }),
          );

          return new CompleteTaskResult({
            summary,
            status: "completed",
          });
        },
      );

      const toolkitHandlers = AgentExecutorTools.of({
        readFile: instrumentTool({ toolName: "readFile", execute: runtime.readFile }),
        writeFile: instrumentTool({ toolName: "writeFile", execute: runtime.writeFile }),
        bash: instrumentTool({ toolName: "bash", execute: runtime.bash }),
        completeTask,
      });

      const toolkit = yield* AgentExecutorTools.asEffect().pipe(
        Effect.provide(AgentExecutorTools.toLayer(toolkitHandlers)),
      );

      yield* ai.streamText({ prompt: buildPrompt(run), toolkit }).pipe(
        Stream.runForEachArray((parts) =>
          Effect.sync(() => {
            response.push(...parts);
          })
        ),
      );

      const messages = yield* Effect.forEach(
        Prompt.fromResponseParts(response).content,
        fromPromptMessage,
      );

      const text = response
        .filter((part): part is Response.TextDeltaPart => part.type === "text-delta")
        .map((part) => part.delta)
        .join("");

      if (text.trim().length > 0) {
        yield* pushEvent(new AgentExecutorAssistantTextEvent({ text }));
      }

      const completionEvent = toCompletionEvent(messages);

      if (completionEvent !== null) {
        yield* pushEvent(completionEvent);
      }

      return new AgentExecutorTurnResult({
        messages,
        events,
      });
    },
    Effect.provide(model),
    Effect.catchTags({
      "ToolkitError": (error) => Effect.fail(toolRuntimeFailed(error)),
      "AgentExecutorError": (error) => Effect.fail(error),
    }),
    Effect.catch((cause) => 
      Effect.logError("Unhandled executor error", { cause }).pipe(
        Effect.andThen(Effect.fail(modelTurnFailed(cause)))
      )
    ),
  );

  return AgentExecutor.of({ executeTurn }) satisfies AgentExecutorShape;
}).pipe(Effect.provide(AgentExecutorToolRuntimeService), Effect.provide(ProviderService));

export const AgentExecutorAdapter = Layer.effect(AgentExecutor, makeImpl);
