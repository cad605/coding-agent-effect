import { Schema } from "effect";

export class AgentRunInput extends Schema.Class("AgentRunInput")({
  prompt: Schema.String,
  system: Schema.NullOr(Schema.String),
}) {}
