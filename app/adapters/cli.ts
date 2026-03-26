import { Effect, Match, pipe, Stream, Terminal } from "effect";
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

    yield* pipe(
      agent.send(new AgentRunInput({ prompt, system: null })),
      Stream.unwrap,
      Stream.runForEach((event: Output) =>
        Match.valueTags(event, {
          TextDelta: () => Effect.void,
          ToolCallStart: () => Effect.void,
          ToolResult: () => Effect.void,
          UsageReport: () => Effect.void,
          Completion: (event) => terminal.display(`${event.summary}\n`),
        })
      ),
    );

    yield* Effect.logDebug("Assistant completed");
  }),
).pipe(Command.withDescription("Coding Assistant"));

export const CliAdapter = Command.run(assistant, {
  version: "1.0.0",
});
