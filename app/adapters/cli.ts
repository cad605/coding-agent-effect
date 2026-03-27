import { Effect, Match, pipe, Stream, Terminal } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { Agent, AgentSendInput } from "../ports/agent.ts";

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
      agent.send(new AgentSendInput({ prompt })),
      Stream.unwrap,
      Stream.runForEach((event) =>
        Match.valueTags(event, {
          TextDelta: ({ delta }) => terminal.display(delta),
          ReasoningDelta: ({ delta }) => terminal.display(delta),
          ToolCall: ({ name }) => terminal.display(`\n[tool: ${name}]\n`),
          ToolResult: ({ name, isFailure }) =>
            terminal.display(`[${isFailure ? "failed" : "done"}: ${name}]\n`),
          Usage: ({ inputTokens, outputTokens }) =>
            terminal.display(`\n(${inputTokens} in / ${outputTokens} out)\n`),
          Ignored: () => Effect.void,
        })
      ),
    );

    yield* Effect.logDebug("Assistant completed");
  }),
).pipe(Command.withDescription("Coding Assistant"));

export const CliAdapter = Command.run(assistant, {
  version: "1.0.0",
});
