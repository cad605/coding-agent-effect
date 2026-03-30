import { Effect, Match, Option, pipe, Ref, Stream, Terminal } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { Prompt, SessionId } from "../domain/models/primitives.ts";
import { ContinueSession, NewSession, ResumeSession } from "../domain/models/session.ts";
import { Agent, AgentSendInput } from "../ports/agent.ts";

const resolveSessionIntent = Effect.fn("cli.resolveSessionIntent")(function*(
  { latest, sessionId }: { latest: boolean; sessionId: Option.Option<string> },
) {
  if (Option.isSome(sessionId)) {
    return ResumeSession.makeUnsafe({ sessionId: SessionId.makeUnsafe(sessionId.value) });
  }

  if (latest) {
    return ContinueSession.makeUnsafe({});
  }

  return NewSession.makeUnsafe({});
});

const assistant = Command.make(
  "assistant",
  {
    prompt: Flag.string("prompt").pipe(
      Flag.withAlias("p"),
      Flag.withDescription("The prompt to operate on."),
    ),
    latest: Flag.boolean("continue").pipe(
      Flag.withAlias("c"),
      Flag.withDescription("Continue the most recent session."),
      Flag.withDefault(false),
    ),
    sessionId: Flag.string("resume").pipe(
      Flag.withAlias("r"),
      Flag.withDescription("Resume a specific session by ID."),
      Flag.optional,
    ),
  },
  Effect.fn("cli.assistant")(function*({ latest, sessionId, prompt }) {
    const agent = yield* Agent;
    const terminal = yield* Terminal.Terminal;

    const sessionIntent = yield* resolveSessionIntent({ latest, sessionId });

    yield* Effect.logDebug("Prompting agent", { prompt, sessionIntent });

    const accumulated = yield* Ref.make("");

    yield* pipe(
      agent.send(
        new AgentSendInput({
          prompt: Prompt.makeUnsafe(prompt),
          sessionIntent,
        }),
      ),
      Stream.unwrap,
      Stream.runForEach((event) =>
        Match.valueTags(event, {
          TextDelta: ({ delta }) => Ref.update(accumulated, (prev) => prev + delta),
          ReasoningDelta: ({ delta }) => Effect.logDebug("Reasoning delta", { delta }),
          ToolCall: () => Ref.set(accumulated, ""),
          ToolResult: ({ name, isFailure }) => Effect.logDebug("Tool result", { name, isFailure }),
          Usage: ({ inputTokens, outputTokens }) => Effect.logDebug("Usage", { inputTokens, outputTokens }),
        })
      ),
    );

    const result = yield* Ref.get(accumulated);

    yield* terminal.display(result);

    yield* Effect.logDebug("Assistant completed");
  }),
).pipe(Command.withDescription("Coding Assistant"));

const listSessions = Command.make(
  "list-sessions",
  {},
  Effect.fn("cli.listSessions")(function*() {
    const agent = yield* Agent;
    const terminal = yield* Terminal.Terminal;

    const sessions = yield* agent.listSessions();
    const output = sessions.map(({ sessionId }) => sessionId).join("\n");

    yield* terminal.display(output);
  }),
).pipe(Command.withDescription("List session IDs from most recent to least recent"));

export const CliAdapter = Command.run(assistant.pipe(Command.withSubcommands([listSessions])), {
  version: "1.0.0",
});
