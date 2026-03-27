import { Effect, Layer, Predicate, Semaphore, Stream } from "effect";

import { AgentError } from "../../domain/errors/agent.ts";
import { Agent, type AgentShape } from "../../ports/agent.ts";
import { Executor } from "../../ports/executor.ts";

/**
 * The `Agent` module implements the `Agent` input port interface.
 *
 * This module orchestrates domain logic and adapters with the goal
 * of managing the agent's interactions with LLM infrastructure
 * and streaming output to the output port.
 */
const makeImpl = Effect.gen(function*() {
  const executor = yield* Executor;

  const semaphore = Semaphore.makeUnsafe(1);

  const send: AgentShape["send"] = Effect.fn("agent.send")(
    function*({ prompt }) {
      yield* Effect.logDebug("Sending agent input", { prompt });

      const stream = yield* executor.stream({ prompt });

      return stream.pipe(
        Stream.takeUntil(Predicate.isTagged("Usage")),
        Stream.catch((cause) => Stream.fail(new AgentError({ cause }))),
      );
    },
    semaphore.withPermits(1),
  );

  return Agent.of({ send }) satisfies AgentShape;
});

export const AgentService = Layer.effect(
  Agent,
  makeImpl,
);
