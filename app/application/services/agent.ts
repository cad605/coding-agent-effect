import { type Cause, Effect, Layer, Queue, Semaphore, Stream } from "effect";

import { AgentError, ExecuteTurnFailed, ModelExecutionFailed, TurnBudgetExceeded } from "../../domain/errors/agent.ts";
import { TurnComplete, TurnInput } from "../../domain/models/agent-executor.ts";
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

  const sendLock = Semaphore.makeUnsafe(1);

  const send: AgentShape["send"] = Effect.fn("agent.send")(
    function*(input) {
      yield* Effect.logDebug("Sending agent input", { input });

      const queue = yield* Queue.make<Output, AgentError | Cause.Done>();

      yield* Effect.gen(function*() {
        let turns = 0;
        while (true) {
          if (turns >= MAX_TURNS) {
            return yield* new AgentError({ reason: new TurnBudgetExceeded({ maxTurns: MAX_TURNS }) });
          }

          const turnInput = turns === 0
            ? new TurnInput({ userMessage: input.prompt, systemPrompt: input.system ?? DEFAULT_SYSTEM_PROMPT })
            : new TurnInput({ userMessage: null, systemPrompt: null });

          let turnComplete: TurnComplete | undefined;

          yield* executor.executeTurn(turnInput).pipe(
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
              () => {
                if (turns > 0) {
                  turnComplete = new TurnComplete({
                    hadToolCall: false,
                    text: "",
                  });
                  return Effect.void;
                }
                return Effect.fail(
                  new AgentError({ reason: new ExecuteTurnFailed({ reason: new ModelExecutionFailed({}) }) }),
                );
              },
            ),
          );

          const turn = turnComplete!;

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
