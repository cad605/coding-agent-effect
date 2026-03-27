import { Schema } from "effect";

export class AgentComplete extends Schema.TaggedClass("AgentComplete")("AgentComplete", {
  text: Schema.String,
}) {}

export type AgentResponse = AgentComplete;

export const AgentResponse = Schema.Union([
  AgentComplete,
]);
