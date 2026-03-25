import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect } from "effect";

import { AgentExecutorAdapter } from "./adapters/agent-executor.ts";
import { CliAdapter } from "./adapters/cli.ts";

import { AgentService } from "./application/services/agent.ts";

CliAdapter.pipe(
  Effect.provide(AgentService),
  Effect.provide(AgentExecutorAdapter),
  Effect.provide(BunServices.layer),
  BunRuntime.runMain,
);
