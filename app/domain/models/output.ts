import { Schema } from "effect";

import { TextDelta, ToolCallStart, ToolResult, UsageReport } from "./agent-executor.ts";

export { TextDelta, ToolCallStart, ToolResult, UsageReport };

export class CompletionOutput extends Schema.TaggedClass("CompletionOutput")("Completion", {
  summary: Schema.String,
  status: Schema.Literal("completed"),
}) {}

export type Output =
  | TextDelta
  | ToolCallStart
  | ToolResult
  | UsageReport
  | CompletionOutput;
export const Output = Schema.Union([
  TextDelta,
  ToolCallStart,
  ToolResult,
  UsageReport,
  CompletionOutput,
]);
