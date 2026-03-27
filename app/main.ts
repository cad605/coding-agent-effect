import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect, Layer } from "effect";

import { CliAdapter } from "./adapters/cli.ts";
import { ExecutorAdapter } from "./adapters/executor.ts";

import { AgentService } from "./application/services/agent.ts";

const AppLayer = AgentService.pipe(
  Layer.provideMerge(ExecutorAdapter),
  Layer.provideMerge(BunServices.layer),
);

CliAdapter.pipe(
  Effect.provide(AppLayer),
  BunRuntime.runMain,
);
