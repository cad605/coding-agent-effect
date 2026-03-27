import { Effect, Match, pipe, Ref, Stream, Terminal } from "effect";
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

    const accumulated = yield* Ref.make("");

    yield* pipe(
      agent.send(new AgentSendInput({ prompt })),
      Stream.unwrap,
      Stream.runForEach((event) =>
        Match.valueTags(event, {
          TextDelta: ({ delta }) => Ref.update(accumulated, (prev) => prev + delta),
          ReasoningDelta: ({ delta }) => Effect.void,
          ToolCall: ({ name }) => Ref.set(accumulated, ""),
          ToolResult: ({ name, isFailure }) => Effect.void,
          Usage: ({ inputTokens, outputTokens }) => Effect.void,
        })
      ),
    );
    
    const result = yield* Ref.get(accumulated);
    yield* terminal.display(result);

    yield* Effect.logDebug("Assistant completed");
  }),
).pipe(Command.withDescription("Coding Assistant"));

export const CliAdapter = Command.run(assistant, {
  version: "1.0.0",
});
