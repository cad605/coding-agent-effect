import { BunRuntime, BunServices } from "@effect/platform-bun";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import { Effect, Layer } from "effect";
import { Chat, IdGenerator } from "effect/unstable/ai";
import { Persistence } from "effect/unstable/persistence";

import { CliAdapter } from "./adapters/cli.ts";
import { ExecutorAdapter } from "./adapters/executor.ts";
import { SessionStoreAdapter } from "./adapters/session-store.ts";

import { AgentService } from "./application/services/agent.ts";

const SESSIONS_DB_PATH = ".sessions.sqlite";

const IdGeneratorLayer = Layer.succeed(
  IdGenerator.IdGenerator,
  IdGenerator.defaultIdGenerator,
);

const SqliteLayer = SqliteClient.layer({
  filename: SESSIONS_DB_PATH,
});

const ChatPersistenceLayer = Chat.layerPersisted({ storeId: "sessions" });

const AppLayer = AgentService.pipe(
  Layer.provideMerge(ExecutorAdapter),
  Layer.provideMerge(SessionStoreAdapter),
  Layer.provideMerge(ChatPersistenceLayer),
  Layer.provideMerge(Persistence.layerBackingSql),
  Layer.provideMerge(SqliteLayer),
  Layer.provideMerge(IdGeneratorLayer),
  Layer.provideMerge(BunServices.layer),
);

CliAdapter.pipe(
  Effect.provide(AppLayer),
  BunRuntime.runMain,
);
