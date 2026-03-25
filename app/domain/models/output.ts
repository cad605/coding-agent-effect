import { Schema } from "effect";

export class AssistantTextOutput extends Schema.TaggedClass("AssistantTextOutput")("AssistantText", {
  text: Schema.String,
}) {}

export class CompletionOutput extends Schema.TaggedClass("CompletionOutput")("Completion", {
  summary: Schema.String,
  status: Schema.Literal("completed"),
}) {}

export const Output = Schema.Union([
  AssistantTextOutput,
  CompletionOutput,
]);
export type Output =
  | AssistantTextOutput
  | CompletionOutput;
