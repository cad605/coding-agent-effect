import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect, Layer } from "effect";

import { AgentExecutorAdapter } from "./adapters/agent-executor.ts";
import { CliAdapter } from "./adapters/cli.ts";

import { AgentService } from "./application/services/agent.ts";

const AppLayer = AgentService.pipe(
  Layer.provideMerge(AgentExecutorAdapter),
  Layer.provideMerge(BunServices.layer),
);

CliAdapter.pipe(
  Effect.provide(AppLayer),
  BunRuntime.runMain,
);
