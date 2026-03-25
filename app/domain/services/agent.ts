import { Effect, Layer } from "effect";

import { AgentExecutor } from "../../ports/agent-executor.ts";
import { Agent, AgentError, type AgentShape } from "../../ports/agent.ts";

const makeImpl = Effect.gen(function*() {
  const session = yield* AgentExecutor;

  const send: AgentShape["send"] = Effect.fn("agent.send")(
    function*({ prompt }) {
      yield* Effect.logDebug("Starting new session", { prompt });

      const response = yield* session.generateResponse({ prompt });

      yield* Effect.logDebug("Returning final response", { response });

      return response;
    },
    Effect.catch((cause) => Effect.fail(new AgentError({ message: "Failed to act", cause }))),
  );

  return Agent.of({ send });
});

export const AgentService = Layer.effect(
  Agent,
  makeImpl,
);
