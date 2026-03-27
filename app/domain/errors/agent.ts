import { Schema } from "effect";

export class AgentError extends Schema.TaggedErrorClass<AgentError>()("AgentError", {
  cause: Schema.Defect,
}) {}
