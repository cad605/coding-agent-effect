import { type Effect, Schema, ServiceMap, type Stream } from "effect";

import type { ExecutorError } from "../domain/errors/executor.ts";
import { Prompt } from "../domain/models/primitives.ts";
import type { TurnEvent } from "../domain/models/turn-event.ts";

export class ExecutorStreamInput extends Schema.Class("ExecutorStreamInput")({
  prompt: Prompt,
}) {}

export interface ExecutorShape {
  stream(input: ExecutorStreamInput): Effect.Effect<Stream.Stream<TurnEvent, ExecutorError>, never>;
}

export class Executor extends ServiceMap.Service<Executor, ExecutorShape>()(
  "app/ports/Executor",
) {}
