import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Console, Effect, Layer } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { AgentLive } from "./adapters/agent.ts";
import { ProviderLive } from "./adapters/provider.ts";
import { ToolsLive } from "./adapters/tools.ts";
import { Agent } from "./ports/agent.ts";

const prompt = Flag.string("prompt").pipe(
  Flag.withAlias("p"),
  Flag.withDescription("The prompt to operate on."),
);

const assistant = Command.make("assistant", { prompt }, ({ prompt }) =>
  Effect.gen(function* () {
    yield* Effect.logDebug("Initializing agent...");

    const agent = yield* Agent;

    yield* Effect.logDebug("Prompting agent...", { prompt });

    const response = yield* agent.act(prompt);

    yield* Effect.logDebug("Collecting response...", { response });

    yield* Console.log(response);

    yield* Effect.logDebug("Assistant completed...");
  }),
).pipe(Command.withDescription("CodeCrafters Assistant"));

const program = Command.run(assistant, {
  version: "1.0.0",
});

const appLayer = AgentLive.pipe(
  Layer.provideMerge(ProviderLive),
  Layer.provideMerge(ToolsLive),
  Layer.provideMerge(BunServices.layer),
);

program.pipe(Effect.provide(appLayer), BunRuntime.runMain);
