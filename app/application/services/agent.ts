import { type Cause, Effect, Layer, MutableRef, Queue, Semaphore, Stream } from "effect";
import { Prompt } from "effect/unstable/ai";

import { AgentError, ExecuteTurnFailed, ModelExecutionFailed, TurnBudgetExceeded } from "../../domain/errors/agent.ts";
import type { TurnComplete } from "../../domain/models/agent-executor.ts";
import { CompletionOutput, type Output } from "../../domain/models/output.ts";

import { AgentExecutor } from "../../ports/agent-executor.ts";
import { Agent, type AgentShape } from "../../ports/agent.ts";

const MAX_TURNS = 24;

const DEFAULT_SYSTEM_PROMPT = [
  "You are a helpful assistant specialized in coding.",
  "Use the available tools whenever they help you inspect the project or make changes.",
].join(" ");

const makeImpl = Effect.gen(function*() {
  const executor = yield* AgentExecutor;

  const history = MutableRef.make(Prompt.empty);
  const sendLock = Semaphore.makeUnsafe(1);

  const send: AgentShape["send"] = Effect.fn("agent.send")(
    function*(input) {
      yield* Effect.logDebug("Sending agent input", { input });

      MutableRef.update(history, Prompt.setSystem(input.system ?? DEFAULT_SYSTEM_PROMPT));
      MutableRef.update(history, Prompt.concat(Prompt.make(input.prompt)));

      const queue = yield* Queue.make<Output, AgentError | Cause.Done>();

      yield* Effect.gen(function*() {
        let turns = 0;
        while (true) {
          if (turns >= MAX_TURNS) {
            return yield* new AgentError({ reason: new TurnBudgetExceeded({ maxTurns: MAX_TURNS }) });
          }

          let turnComplete: TurnComplete | undefined;

          yield* executor.executeTurn(MutableRef.get(history)).pipe(
            Stream.runForEach((event) => {
              if (event._tag === "TurnComplete") {
                turnComplete = event;
                return Effect.void;
              }
              Queue.offerUnsafe(queue, event);
              return Effect.void;
            }),
            Effect.catchTag(
              "AgentExecutorError",
              () =>
                Effect.fail(
                  new AgentError({ reason: new ExecuteTurnFailed({ reason: new ModelExecutionFailed({}) }) }),
                ),
            ),
          );

          const turn = turnComplete!;
          MutableRef.update(history, Prompt.concat(turn.promptDelta));

          if (turn.completionSummary !== null) {
            yield* Queue.offer(queue, new CompletionOutput({ summary: turn.completionSummary, status: "completed" }));
            return;
          }

          if (!turn.hadToolCall) {
            yield* Queue.offer(queue, new CompletionOutput({ summary: turn.text, status: "completed" }));
            return;
          }

          turns++;
        }
      }).pipe(
        Effect.catchCause((cause) => Queue.failCause(queue, cause)),
        Effect.ensuring(Queue.end(queue)),
        Effect.forkScoped,
      );

      return Stream.fromQueue(queue);
    },
    Stream.unwrap,
    Stream.broadcast({ capacity: "unbounded", replay: 1 }),
    sendLock.withPermit,
  );

  return Agent.of({ send }) satisfies AgentShape;
});

export const AgentService = Layer.effect(
  Agent,
  makeImpl,
);
