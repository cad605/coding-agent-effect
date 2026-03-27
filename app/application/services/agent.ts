import { Effect, Layer, Match, Semaphore, Stream } from "effect";

import { AgentError } from "../../domain/errors/agent.ts";
import type { SessionId } from "../../domain/models/primitives.ts";
import type { SessionIntent } from "../../domain/models/session.ts";
import { Agent, type AgentShape } from "../../ports/agent.ts";
import { Executor } from "../../ports/executor.ts";
import { SessionStore, SessionStoreLoadInput, SessionStoreSaveInput } from "../../ports/session-store.ts";

/**
 * The `Agent` module implements the `Agent` input port interface.
 *
 * This module orchestrates domain logic and adapters with the goal
 * of managing the agent's interactions with LLM infrastructure
 * and streaming output to the output port.
 */
const makeImpl = Effect.gen(function*() {
  const executor = yield* Executor;
  const sessionStore = yield* SessionStore;

  const semaphore = Semaphore.makeUnsafe(1);

  const resolveSession = Effect.fn("agent.resolveSession")(function*({ intent }: { intent: SessionIntent }) {
    return yield* Match.valueTags(intent, {
      NewSession: () =>
        sessionStore.create().pipe(
          Effect.map((metadata) => ({
            sessionId: metadata.sessionId,
            history: undefined as string | undefined,
          })),
        ),
      ContinueSession: () =>
        sessionStore.loadLatest().pipe(
          Effect.map(({ metadata, history }) => ({
            sessionId: metadata.sessionId,
            history: history || undefined,
          })),
        ),
      ResumeSession: ({ sessionId }) =>
        sessionStore.load(new SessionStoreLoadInput({ sessionId })).pipe(
          Effect.map(({ metadata, history }) => ({
            sessionId: metadata.sessionId,
            history: history || undefined,
          })),
        ),
    });
  }, Effect.catch((cause) => Effect.fail(new AgentError({ cause }))));

  const persistSession = Effect.fn("agent.persistSession")(
    function*({ sessionId, exportHistory }: { sessionId: SessionId; exportHistory: Effect.Effect<string, unknown> }) {
      const history = yield* exportHistory;

      return yield* sessionStore.save(new SessionStoreSaveInput({ sessionId, history }));
    },
    Effect.catch((cause) => Effect.logWarning("Failed to persist session", { cause })),
  );

  const send: AgentShape["send"] = Effect.fn("agent.send")(
    function*({ prompt, sessionIntent }) {
      yield* Effect.logDebug("Sending agent input", { prompt });

      const { sessionId, history } = yield* resolveSession({ intent: sessionIntent });

      yield* Effect.logDebug("Session resolved", { sessionId });

      const { events, exportHistory } = yield* executor.stream({ prompt, history });

      return events.pipe(
        Stream.ensuring(persistSession({ sessionId, exportHistory })),
        Stream.mapError((cause) => new AgentError({ cause })),
      );
    },
    Effect.catch((cause) => Effect.fail(new AgentError({ cause }))),
    semaphore.withPermits(1),
  );

  return Agent.of({ send }) satisfies AgentShape;
});

export const AgentService = Layer.effect(
  Agent,
  makeImpl,
);
