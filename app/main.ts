import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Console, Effect, Layer } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { AiAssistantLive } from "./adapters/ai-assistant.ts";
import { FileSystemToolsLive } from "./adapters/file-system-tools.ts";
import { OpenRouterLive } from "./adapters/open-router.ts";
import { Assistant } from "./ports/assistant.ts";

const prompt = Flag.string("prompt").pipe(
  Flag.withAlias("p"),
  Flag.withDescription("The prompt to operate on."),
);

const assistant = Command.make("assistant", { prompt }, ({ prompt }) =>
  Effect.gen(function* () {
    const assistant = yield* Assistant;

    const { text, toolCalls } = yield* assistant.answer(prompt);

    if (toolCalls.length === 0) {
      yield* Console.log(text);
    }
  }),
).pipe(Command.withDescription("CodeCrafters Assistant"));

const program = Command.run(assistant, {
  version: "1.0.0",
});

const appLayer = AiAssistantLive.pipe(
  Layer.provideMerge(OpenRouterLive),
  Layer.provideMerge(FileSystemToolsLive),
  Layer.provideMerge(BunServices.layer),
);

program.pipe(Effect.provide(appLayer), BunRuntime.runMain);
