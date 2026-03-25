import { Schema } from "effect";

export class AgentRunTextPart extends Schema.Class("AgentRunTextPart")({
  type: Schema.Literal("text"),
  text: Schema.String,
}) {}

export class AgentRunReasoningPart extends Schema.Class("AgentRunReasoningPart")({
  type: Schema.Literal("reasoning"),
  text: Schema.String,
}) {}

export class AgentRunToolCallPart extends Schema.Class("AgentRunToolCallPart")({
  type: Schema.Literal("tool-call"),
  id: Schema.String,
  name: Schema.String,
  params: Schema.Unknown,
  providerExecuted: Schema.Boolean,
}) {}

export class AgentRunToolResultPart extends Schema.Class("AgentRunToolResultPart")({
  type: Schema.Literal("tool-result"),
  id: Schema.String,
  name: Schema.String,
  isFailure: Schema.Boolean,
  result: Schema.Unknown,
}) {}

export const AgentRunAssistantPart = Schema.Union([
  AgentRunTextPart,
  AgentRunReasoningPart,
  AgentRunToolCallPart,
  AgentRunToolResultPart,
]);
export type AgentRunAssistantPart =
  | AgentRunTextPart
  | AgentRunReasoningPart
  | AgentRunToolCallPart
  | AgentRunToolResultPart;

export class AgentRunSystemMessage extends Schema.Class("AgentRunSystemMessage")({
  role: Schema.Literal("system"),
  content: Schema.String,
}) {}

export class AgentRunUserMessage extends Schema.Class("AgentRunUserMessage")({
  role: Schema.Literal("user"),
  content: Schema.String,
}) {}

export class AgentRunAssistantMessage extends Schema.Class("AgentRunAssistantMessage")({
  role: Schema.Literal("assistant"),
  content: Schema.Array(AgentRunAssistantPart),
}) {
  declare readonly role: "assistant";
  declare readonly content: ReadonlyArray<AgentRunAssistantPart>;
}

export class AgentRunToolMessage extends Schema.Class("AgentRunToolMessage")({
  role: Schema.Literal("tool"),
  content: Schema.Array(AgentRunToolResultPart),
}) {
  declare readonly role: "tool";
  declare readonly content: ReadonlyArray<AgentRunToolResultPart>;
}

export const AgentRunMessage = Schema.Union([
  AgentRunSystemMessage,
  AgentRunUserMessage,
  AgentRunAssistantMessage,
  AgentRunToolMessage,
]);
export type AgentRunMessage =
  | AgentRunSystemMessage
  | AgentRunUserMessage
  | AgentRunAssistantMessage
  | AgentRunToolMessage;

export class AgentSession extends Schema.Class("AgentSession")({
  messages: Schema.Array(AgentRunMessage),
}) {
  declare readonly messages: ReadonlyArray<AgentRunMessage>;
}

export class AgentRunInput extends Schema.Class("AgentRunInput")({
  prompt: Schema.String,
  system: Schema.NullOr(Schema.String),
  session: Schema.NullOr(AgentSession),
}) {
  declare readonly prompt: string;
  declare readonly system: string | null;
  declare readonly session: AgentSession | null;
}

export class AgentRunState extends Schema.Class("AgentRunState")({
  messages: Schema.Array(AgentRunMessage),
}) {
  declare readonly messages: ReadonlyArray<AgentRunMessage>;
}
