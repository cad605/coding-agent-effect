import { OpenRouterLanguageModel } from "@effect/ai-openrouter";
import { Effect, Layer, Match, Stream } from "effect";
import { Chat } from "effect/unstable/ai";

import { AgentExecutorError, ModelTurnFailed, ToolRuntimeFailed } from "../domain/errors/agent-executor.ts";
import { AgentExecutorTurnResult } from "../domain/models/agent-executor.ts";
import { AssistantTextOutput, CompletionOutput } from "../domain/models/output.ts";
import { buildSessionMessages } from "../domain/utils/agent-run-state.ts";
import { AgentExecutor } from "../ports/agent-executor.ts";
import type { AgentExecutorSession, AgentExecutorShape } from "../ports/agent-executor.ts";
import { AgentExecutorTools, AgentExecutorToolsService } from "./services/agent-executor-tools.ts";
import type { ToolkitError } from "./services/agent-executor-tools.ts";
import { ProviderService } from "./services/provider.ts";

interface TurnState {
  readonly text: string;
  readonly hadToolCall: boolean;
  readonly completionSummary: string | null;
}

const initialTurnState = (): TurnState => ({
  text: "",
  hadToolCall: false,
  completionSummary: null,
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

const makeImpl = Effect.gen(function*() {
  const toolkit = yield* AgentExecutorTools;
  const model = yield* OpenRouterLanguageModel.model("anthropic/claude-haiku-4.5");

  const createSession: AgentExecutorShape["createSession"] = Effect.fn("agent-executor.createSession")(
    function*(input, emit) {
      const chat = yield* Chat.fromPrompt(buildSessionMessages(input));

      const executeTurn: AgentExecutorSession["executeTurn"] = Effect.fn("agent-executor.executeTurn")(
        function*() {
          yield* Effect.logDebug("Executing agent turn");

          const turn = yield* chat.streamText({ prompt: [], toolkit }).pipe(
            Stream.runFoldEffect(initialTurnState, (state, part) =>
              Match.value(part).pipe(
                Match.when({ type: "text-delta" }, (p) =>
                  Effect.succeed({ ...state, text: state.text + p.delta }),
                ),
                Match.when({ type: "tool-call" }, () =>
                  Effect.succeed({ ...state, hadToolCall: true }),
                ),
                Match.when(
                  { type: "tool-result", name: "completeTask", isFailure: false, preliminary: false },
                  (p) => {
                    const summary = (p.result as { summary: string }).summary;
                    return emit(new CompletionOutput({ summary, status: "completed" })).pipe(
                      Effect.map(() => ({ ...state, completionSummary: summary })),
                    );
                  },
                ),
                Match.orElse(() => Effect.succeed(state)),
              ),
            ),
          );

          if (turn.text.trim().length > 0) {
            yield* emit(new AssistantTextOutput({ text: turn.text }));
          }

          return new AgentExecutorTurnResult({
            hadToolCall: turn.hadToolCall,
            completed: turn.completionSummary !== null,
          });
        },
        Effect.provide(model),
        Effect.catchTag("ToolkitError", (error: ToolkitError) =>
          Effect.fail(
            new AgentExecutorError({
              reason: new ToolRuntimeFailed({
                toolName: toToolName(error),
                message: error.message,
              }),
            }),
          )),
        Effect.catch((cause) =>
          Effect.fail(
            new AgentExecutorError({
              reason: new ModelTurnFailed({ cause }),
            }),
          )
        ),
      );

      return { executeTurn } satisfies AgentExecutorSession;
    },
  );

  return AgentExecutor.of({ createSession }) satisfies AgentExecutorShape;
}).pipe(Effect.provide(AgentExecutorToolsService), Effect.provide(ProviderService));

export const AgentExecutorAdapter = Layer.effect(AgentExecutor, makeImpl);
