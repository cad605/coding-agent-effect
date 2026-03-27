import { Schema } from "effect";

export class ExecutorError extends Schema.TaggedErrorClass<ExecutorError>()("ExecutorError", {
  cause: Schema.Defect,
}) {}
