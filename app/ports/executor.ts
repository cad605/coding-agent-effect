import { type Effect, Schema, ServiceMap, type Stream } from "effect";

import type { ExecutorError } from "../domain/errors/executor.ts";
import { Prompt } from "../domain/models/primitives.ts";
import type { TurnEvent } from "../domain/models/turn-event.ts";

export class ExecutorStreamInput extends Schema.Class("ExecutorStreamInput")({
  prompt: Prompt,
  history: Schema.optional(Schema.String),
}) {}

export interface ExecutorStreamResult {
  readonly events: Stream.Stream<TurnEvent, ExecutorError>;
  readonly exportHistory: Effect.Effect<string, ExecutorError>;
}

export interface ExecutorShape {
  stream(input: ExecutorStreamInput): Effect.Effect<ExecutorStreamResult, never>;
}

export class Executor extends ServiceMap.Service<Executor, ExecutorShape>()(
  "app/ports/Executor",
) {}
