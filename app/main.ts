import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Console, Effect, Layer } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { AgentLive } from "./adapters/agent.ts";
import { FileSystemToolsLive } from "./adapters/file-system-tools.ts";
import { OpenRouterLive } from "./adapters/open-router.ts";
import { Agent } from "./ports/agent.ts";

const prompt = Flag.string("prompt").pipe(
  Flag.withAlias("p"),
  Flag.withDescription("The prompt to operate on."),
);

const assistant = Command.make("assistant", { prompt }, ({ prompt }) =>
  Effect.gen(function* () {
    const agent = yield* Agent;

    const response = yield* agent.answer(prompt);

    yield* Console.log(response);
  }),
).pipe(Command.withDescription("CodeCrafters Assistant"));

const program = Command.run(assistant, {
  version: "1.0.0",
});

const appLayer = AgentLive.pipe(
  Layer.provideMerge(OpenRouterLive),
  Layer.provideMerge(FileSystemToolsLive),
  Layer.provideMerge(BunServices.layer),
);

program.pipe(Effect.provide(appLayer), BunRuntime.runMain);
