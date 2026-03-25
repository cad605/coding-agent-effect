import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Stream from "effect/Stream";
import * as Prompt from "effect/unstable/ai/Prompt";

import {
  AgentExecutor,
  type AgentExecutorEvent,
} from "../../ports/agent-executor.ts";
import {
  Agent,
  AgentCompletionEvent,
  AgentError,
  AgentTextEvent,
  type AgentEvent,
  type AgentShape,
  AgentToolCallEvent,
  AgentToolFailureEvent,
  AgentToolResultEvent,
} from "../../ports/agent.ts";

const DEFAULT_SYSTEM_PROMPT = [
  "You are a helpful assistant specialized in coding.",
  "Use the available tools whenever they help you inspect the project or make changes.",
  'When you have fully completed the user request, you must call the "completeTask" tool with a concise final summary.',
  "Do not treat plain assistant text as task completion.",
].join(" ");

const MAX_TURNS = 24;

const toAgentError = (
  message: string,
  cause: unknown,
) => new AgentError({ message, cause });

const mapExecutorEvent = (
  event: AgentExecutorEvent,
): AgentEvent =>
  Match.valueTags(event, {
    AssistantText: (event) => new AgentTextEvent({ text: event.text }),
    ToolCall: (event) => new AgentToolCallEvent({
      toolName: event.toolName,
      input: event.input,
    }),
    ToolResult: (event) => new AgentToolResultEvent({
      toolName: event.toolName,
      output: event.output,
      durationMs: event.durationMs,
      truncated: event.truncated,
    }),
    ToolFailure: (event) => new AgentToolFailureEvent({
      toolName: event.toolName,
      message: event.message,
      durationMs: event.durationMs,
      truncated: event.truncated,
    }),
    Completion: (event) => new AgentCompletionEvent({
      summary: event.summary,
      status: event.status,
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

const runLoop = (
  executor: AgentExecutor["Service"],
  prompt: Prompt.Prompt,
  turnCount: number,
): Stream.Stream<AgentEvent, AgentError> =>
  Stream.unwrap(
    Effect.gen(function*() {
      if (turnCount >= MAX_TURNS) {
        return Stream.fail(
          toAgentError(
            "Agent exceeded the maximum number of turns without explicit completion",
            new Error("Maximum turn count exceeded"),
          ),
        );
      }

      const turn = yield* executor.executeTurn({ prompt }).pipe(
        Effect.mapError((error) => toAgentError("Failed to execute agent turn", error)),
      );

      const current = Stream.fromIterable(turn.events.map(mapExecutorEvent));

      if (turn.events.some(isCompletionEvent)) {
        return current;
      }

      if (!turn.events.some(isToolActivityEvent)) {
        return Stream.concat(
          current,
          Stream.fail(
            toAgentError(
              "Agent turn ended without explicit completion or tool activity",
              new Error("Missing completion signal"),
            ),
          ),
        );
      }

      return Stream.concat(
        current,
        runLoop(executor, turn.prompt, turnCount + 1),
      );
    }),
  );

const makeImpl = Effect.gen(function*() {
  const executor = yield* AgentExecutor;

  const send: AgentShape["send"] = Effect.fn("agent.send")(
    function*({ prompt, system }) {
      yield* Effect.logDebug("Starting new session", { prompt });

      const initialPrompt = pipe(
        Prompt.make(prompt),
        Prompt.setSystem(system ?? DEFAULT_SYSTEM_PROMPT),
      );

      return runLoop(executor, initialPrompt, 0);
    },
    Effect.catch((cause) => Effect.fail(new AgentError({ message: "Failed to act", cause }))),
  );

  return Agent.of({ send });
});

export const AgentService = Layer.effect(
  Agent,
  makeImpl,
);
