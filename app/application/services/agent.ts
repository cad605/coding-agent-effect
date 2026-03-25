import { Effect, Layer, Queue, Stream } from "effect";

import type { AgentError } from "../../domain/errors/agent.ts";
import { mapAgentExecutorError } from "../../domain/utils/agent-error-mapper.ts";
import {
  hasReachedTurnBudget,
  missingCompletionSignalError,
  turnBudgetExceededError,
  turnHasCompletion,
  turnHasToolActivity,
} from "../../domain/utils/agent-turn-policy.ts";
import type { Output } from "../../domain/models/output.ts";
import { AgentExecutor } from "../../ports/agent-executor.ts";
import type { AgentExecutorSession } from "../../ports/agent-executor.ts";
import { Agent, type AgentShape } from "../../ports/agent.ts";

const makeImpl = Effect.gen(function*() {
  const executor = yield* AgentExecutor;

  const runAgentLoop = Effect.fn("agent.runAgentLoop")(
    function*(
      { session, turns }: { session: AgentExecutorSession; turns: number },
    ): Effect.fn.Return<void, AgentError> {
      if (hasReachedTurnBudget(turns)) {
        yield* Effect.fail(turnBudgetExceededError());
      }

      const turn = yield* session.executeTurn().pipe(
        Effect.catchTag("AgentExecutorError", (error) => Effect.fail(mapAgentExecutorError(error))),
      );

      if (turnHasCompletion(turn)) {
        return;
      }

      if (!turnHasToolActivity(turn)) {
        yield* Effect.fail(missingCompletionSignalError());
      }

      yield* runAgentLoop({
        session,
        turns: turns + 1,
      });
    },
  );

  const send: AgentShape["send"] = Effect.fn("agent.send")(function*(input) {
    yield* Effect.logDebug(
      "Sending agent input",
      { input },
    );

    return Stream.callback<Output, AgentError>((queue) =>
      Effect.gen(function*() {
        const session = yield* executor.createSession(
          input,
          (output) => Queue.offer(queue, output),
        ).pipe(
          Effect.catchTag("AgentExecutorError", (error) => Effect.fail(mapAgentExecutorError(error))),
        );

        yield* runAgentLoop({ session, turns: 0 }).pipe(
          Effect.matchEffect({
            onFailure: (error) => Queue.fail(queue, error),
            onSuccess: () => Queue.end(queue),
          }),
          Effect.forkScoped,
        );
      })
    );
  });

  return Agent.of({ send }) satisfies AgentShape;
});

export const AgentService = Layer.effect(
  Agent,
  makeImpl,
);
