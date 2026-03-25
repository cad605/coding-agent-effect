import { Effect, Layer, Match, Stream } from "effect";

import {
  AgentExecutor,
  type AgentExecutorError,
  type AgentExecutorEvent,
  AgentExecutorTurnInput,
} from "../../ports/agent-executor.ts";
import { AgentRunState, AgentRunSystemMessage, AgentRunUserMessage } from "../../ports/agent-runtime.ts";
import {
  Agent,
  AgentCompletionEvent,
  AgentError,
  type AgentEvent,
  type AgentShape,
  AgentTextEvent,
  AgentToolCallEvent,
  AgentToolFailureEvent,
  AgentToolResultEvent,
  ExecuteTurnFailed,
  MissingCompletionSignal,
  ModelExecutionFailed,
  ToolExecutionFailed,
  TurnBudgetExceeded,
  UnsupportedRunMessage,
  UnsupportedRunPart,
} from "../../ports/agent.ts";

const DEFAULT_SYSTEM_PROMPT = [
  "You are a helpful assistant specialized in coding.",
  "Use the available tools whenever they help you inspect the project or make changes.",
  "When you have fully completed the user request, you must call the \"completeTask\" tool with a concise final summary.",
  "Do not treat plain assistant text as task completion.",
].join(" ");

const MAX_TURNS = 24;

const executeTurnFailed = (error: AgentExecutorError) =>
  Match.valueTags(error.reason, {
    UnsupportedRuntimeMessage: ({ role }) =>
      new AgentError({
        reason: new ExecuteTurnFailed({
          reason: new UnsupportedRunMessage({ role }),
        }),
      }),
    UnsupportedRuntimePart: ({ partType }) =>
      new AgentError({
        reason: new ExecuteTurnFailed({
          reason: new UnsupportedRunPart({ partType }),
        }),
      }),
    ToolRuntimeFailed: ({ toolName, message }) =>
      new AgentError({
        reason: new ExecuteTurnFailed({
          reason: new ToolExecutionFailed({ toolName, message }),
        }),
      }),
    ModelTurnFailed: () =>
      new AgentError({
        reason: new ExecuteTurnFailed({
          reason: new ModelExecutionFailed({}),
        }),
      }),
  });

const mapExecutorEvent = (
  event: AgentExecutorEvent,
): AgentEvent =>
  Match.valueTags(event, {
    AssistantText: ({ text }) => new AgentTextEvent({ text }),
    ToolCall: ({ toolName, input }) =>
      new AgentToolCallEvent({
        toolName,
        input,
      }),
    ToolResult: ({ toolName, output, durationMs, truncated }) =>
      new AgentToolResultEvent({
        toolName,
        output,
        durationMs,
        truncated,
      }),
    ToolFailure: ({ toolName, message, durationMs, truncated }) =>
      new AgentToolFailureEvent({
        toolName,
        message,
        durationMs,
        truncated,
      }),
    Completion: ({ summary, status }) =>
      new AgentCompletionEvent({
        summary,
        status,
      }),
  });

const isCompletionEvent = (
  event: AgentExecutorEvent,
) => event._tag === "Completion";

const isToolActivityEvent = (
  event: AgentExecutorEvent,
) =>
  event._tag === "ToolCall"
  || event._tag === "ToolResult"
  || event._tag === "ToolFailure";

const makeImpl = Effect.gen(function*() {
  const executor = yield* AgentExecutor;

  const runAgentLoop = Effect.fn("agent.runAgentLoop")(
    function*(
      { run, turns }: { run: AgentRunState; turns: number },
    ): Effect.fn.Return<Stream.Stream<AgentEvent, AgentError>, AgentError> {
      if (turns >= MAX_TURNS) {
        return Stream.fail(
          new AgentError({
            reason: new TurnBudgetExceeded({ maxTurns: MAX_TURNS }),
          }),
        );
      }

      const turn = yield* executor.executeTurn(new AgentExecutorTurnInput({ run })).pipe(
        Effect.catchTag("AgentExecutorError", (error) => Effect.fail(executeTurnFailed(error))),
      );

      const current = Stream.fromIterable(turn.events.map(mapExecutorEvent));

      const nextRun = new AgentRunState({
        messages: [...run.messages, ...turn.messages],
      });

      if (turn.events.some(isCompletionEvent)) {
        return current;
      }

      if (!turn.events.some(isToolActivityEvent)) {
        return Stream.concat(
          current,
          Stream.fail(
            new AgentError({
              reason: new MissingCompletionSignal({}),
            }),
          ),
        );
      }

      return Stream.concat(
        current,
        Stream.unwrap(runAgentLoop({ run: nextRun, turns: turns + 1 })),
      );
    },
  );

  const send: AgentShape["send"] = Effect.fn("agent.send")(function*({ prompt, system }) {
    yield* Effect.logDebug("Starting new session", { prompt });

    const run = new AgentRunState({
      messages: [
        new AgentRunSystemMessage({
          content: system ?? DEFAULT_SYSTEM_PROMPT,
          role: "system",
        }),
        new AgentRunUserMessage({
          content: prompt,
          role: "user",
        }),
      ],
    });

    return Stream.unwrap(runAgentLoop({ run, turns: 0 }));
  });

  return Agent.of({ send }) satisfies AgentShape;
});

export const AgentService = Layer.effect(
  Agent,
  makeImpl,
);
