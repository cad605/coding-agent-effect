import { OpenRouterLanguageModel } from "@effect/ai-openrouter";
import { Effect, Layer, Stream } from "effect";
import { Chat } from "effect/unstable/ai";

import { AgentExecutorError, ModelTurnFailed, ToolRuntimeFailed } from "../domain/errors/agent-executor.ts";
import { AgentExecutorTurnResult } from "../domain/models/agent-executor.ts";
import {
  AssistantTextOutput,
  CompletionOutput,
} from "../domain/models/output.ts";
import { buildSessionMessages } from "../domain/utils/agent-run-state.ts";
import { AgentExecutor } from "../ports/agent-executor.ts";
import type { AgentExecutorSession, AgentExecutorShape } from "../ports/agent-executor.ts";
import {
  AgentExecutorToolRuntime,
  AgentExecutorToolRuntimeService,
  AgentExecutorTools,
} from "./services/agent-executor-tools.ts";
import type { ToolkitError } from "./services/agent-executor-tools.ts";
import { ProviderService } from "./services/provider.ts";

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

const makeImpl = Effect.gen(function*() {
  const runtime = yield* AgentExecutorToolRuntime;
  const model = yield* OpenRouterLanguageModel.model("anthropic/claude-haiku-4.5");

  const createSession: AgentExecutorShape["createSession"] = Effect.fn("agent-executor.createSession")(
    function*(input, emit) {
      const chat = yield* Chat.fromPrompt(buildSessionMessages(input));

      const executeTurn: AgentExecutorSession["executeTurn"] = Effect.fn("agent-executor.executeTurn")(
        function*() {
          yield* Effect.logDebug("Executing agent turn");

          let hadToolCall = false;
          let completed = false;
          let completionSummary: string | null = null;

          const toolkitHandlers = AgentExecutorTools.of({
            readFile: Effect.fn("tool.readFile")(function*(toolInput) {
              hadToolCall = true;
              return yield* runtime.readFile(toolInput);
            }),
            writeFile: Effect.fn("tool.writeFile")(function*(toolInput) {
              hadToolCall = true;
              return yield* runtime.writeFile(toolInput);
            }),
            bash: Effect.fn("tool.bash")(function*(toolInput) {
              hadToolCall = true;
              return yield* runtime.bash(toolInput);
            }),
            completeTask: Effect.fn("tool.completeTask")(function*(toolInput) {
              hadToolCall = true;
              completed = true;
              completionSummary = toolInput.summary;
              return yield* runtime.completeTask(toolInput);
            }),
          });

          const toolkit = yield* AgentExecutorTools.asEffect().pipe(
            Effect.provide(AgentExecutorTools.toLayer(toolkitHandlers)),
          );

          const text = yield* chat.streamText({ prompt: [], toolkit }).pipe(
            Stream.runFold(() => "", (acc, part) =>
              part.type === "text-delta" ? acc + part.delta : acc
            ),
          );

          if (text.trim().length > 0) {
            yield* emit(new AssistantTextOutput({ text }));
          }

          if (completed) {
            yield* emit(
              new CompletionOutput({
                summary: completionSummary ?? "Task completed",
                status: "completed",
              }),
            );
          }

          return new AgentExecutorTurnResult({ hadToolCall, completed });
        },
        Effect.provide(model),
        Effect.catchTag("ToolkitError", (error) => Effect.fail(toolRuntimeFailed(error))),
        Effect.catch((cause) => Effect.fail(modelTurnFailed(cause))),
      );

      return { executeTurn } satisfies AgentExecutorSession;
    },
  );

  return AgentExecutor.of({ createSession }) satisfies AgentExecutorShape;
}).pipe(Effect.provide(AgentExecutorToolRuntimeService), Effect.provide(ProviderService));

export const AgentExecutorAdapter = Layer.effect(AgentExecutor, makeImpl);
