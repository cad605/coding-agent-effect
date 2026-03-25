import { Effect, Match, Stream, Terminal } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { Agent } from "../ports/agent.ts";

const renderToolInput = (input: string) => input;
const renderToolOutput = (output: string | null) => output ?? "(no output)";

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

    const events = yield* agent.send({ prompt });

    yield* Effect.logDebug("Streaming agent response");

    yield* events.pipe(Stream.runForEach((event) =>
      Match.valueTags(event, {
        AgentText: (event) => terminal.display(event.text),
        AgentToolCall: (event) =>
          terminal.display(`[tool:${event.toolName}] start ${renderToolInput(event.input)}`),
        AgentToolResult: (event) =>
          terminal.display(
            `[tool:${event.toolName}] done in ${event.durationMs}ms: ${renderToolOutput(event.output)}`,
          ),
        AgentToolFailure: (event) =>
          terminal.display(
            `[tool:${event.toolName}] failed in ${event.durationMs}ms: ${event.message}`,
          ),
        AgentCompletion: (event) =>
          terminal.display(`Task complete: ${event.summary}`),
      })
    ));

    yield* Effect.logDebug("Assistant completed");
  }),
).pipe(Command.withDescription("Coding Assistant"));

export const CliAdapter = Command.run(assistant, {
  version: "1.0.0",
});
