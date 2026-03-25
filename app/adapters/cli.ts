import { Effect, Match, Stream, Terminal } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { AgentRunInput } from "../domain/models/agent-run.ts";
import type { Output } from "../domain/models/output.ts";
import { Agent } from "../ports/agent.ts";

const assistant = Command.make(
  "assistant",
  {
    prompt: Flag.string("prompt").pipe(
      Flag.withAlias("p"),
      Flag.withDescription("The prompt to operate on."),
    ),
  },
  Effect.fn("cli.assistant")(function*({ prompt }: { prompt: string }) {
    const agent = yield* Agent;
    const terminal = yield* Terminal.Terminal;

    yield* Effect.logDebug("Prompting agent", { prompt });

    const events = yield* agent.send(new AgentRunInput({ prompt, system: null, session: null }));

    yield* Effect.logDebug("Streaming agent response");

    yield* events.pipe(Stream.runForEach((event: Output) =>
      Match.valueTags(event, {
        AssistantText: (event) => terminal.display(event.text),
        Completion: (event) => terminal.display(`Task complete: ${event.summary}`),
      })
    ));

    yield* Effect.logDebug("Assistant completed");
  }),
).pipe(Command.withDescription("Coding Assistant"));

export const CliAdapter = Command.run(assistant, {
  version: "1.0.0",
});
