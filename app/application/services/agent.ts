import { Effect, Layer, Stream } from "effect";

import type { AgentError } from "../../domain/errors/agent.ts";
import type { AgentEvent } from "../../domain/models/agent-events.ts";
import { AgentExecutorTurnInput } from "../../domain/models/agent-executor.ts";
import { AgentRunState } from "../../domain/models/agent-run.ts";
import { mapAgentExecutorError } from "../../domain/utils/agent-error-mapper.ts";
import { mapExecutorEvent } from "../../domain/utils/agent-event-mapper.ts";
import { buildRunState } from "../../domain/utils/agent-run-state.ts";
import {
  hasReachedTurnBudget,
  missingCompletionSignalError,
  turnBudgetExceededError,
  turnHasCompletion,
  turnHasToolActivity,
} from "../../domain/utils/agent-turn-policy.ts";
import { AgentExecutor } from "../../ports/agent-executor.ts";
import { Agent, type AgentShape } from "../../ports/agent.ts";

const makeImpl = Effect.gen(function*() {
  const executor = yield* AgentExecutor;

  const runAgentLoop = Effect.fn("agent.runAgentLoop")(
    function*(
      { run, turns }: { run: AgentRunState; turns: number },
    ): Effect.fn.Return<Stream.Stream<AgentEvent, AgentError>, AgentError> {
      if (hasReachedTurnBudget(turns)) {
        return Stream.fail(turnBudgetExceededError());
      }

      const turn = yield* executor.executeTurn(new AgentExecutorTurnInput({ run })).pipe(
        Effect.catchTag("AgentExecutorError", (error) => Effect.fail(mapAgentExecutorError(error))),
      );

      const current = Stream.fromIterable(turn.events.map(mapExecutorEvent));

      if (turnHasCompletion(turn)) {
        return current;
      }

      if (!turnHasToolActivity(turn)) {
        return Stream.concat(
          current,
          Stream.fail(missingCompletionSignalError()),
        );
      }

      return Stream.concat(
        current,
        Stream.unwrap(runAgentLoop({
          run: new AgentRunState({
            messages: [...run.messages, ...turn.messages],
          }),
          turns: turns + 1,
        })),
      );
    },
  );

  const send: AgentShape["send"] = Effect.fn("agent.send")(function*(input) {
    const run = buildRunState(input);

    yield* Effect.logDebug(
      input.session === null ? "Starting new session" : "Continuing session",
      { prompt: input.prompt },
    );

    return Stream.unwrap(runAgentLoop({ run, turns: 0 }));
  });

  return Agent.of({ send }) satisfies AgentShape;
});

export const AgentService = Layer.effect(
  Agent,
  makeImpl,
);
