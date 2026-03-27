import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect, Layer } from "effect";
import { IdGenerator } from "effect/unstable/ai";

import { CliAdapter } from "./adapters/cli.ts";
import { ExecutorAdapter } from "./adapters/executor.ts";
import { SessionStoreAdapter } from "./adapters/session-store.ts";

import { AgentService } from "./application/services/agent.ts";

const IdGeneratorLayer = Layer.succeed(
  IdGenerator.IdGenerator,
  IdGenerator.defaultIdGenerator,
);

const AppLayer = AgentService.pipe(
  Layer.provideMerge(ExecutorAdapter),
  Layer.provideMerge(SessionStoreAdapter),
  Layer.provideMerge(IdGeneratorLayer),
  Layer.provideMerge(BunServices.layer),
);

CliAdapter.pipe(
  Effect.provide(AppLayer),
  BunRuntime.runMain,
);
