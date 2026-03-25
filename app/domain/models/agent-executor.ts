import { Schema } from "effect";

export class AgentExecutorTurnResult extends Schema.Class("AgentExecutorTurnResult")({
  hadToolCall: Schema.Boolean,
  completed: Schema.Boolean,
}) {
  declare readonly hadToolCall: boolean;
  declare readonly completed: boolean;
}
