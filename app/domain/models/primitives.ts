import { Schema } from "effect";

export const Prompt = Schema.String.pipe(Schema.brand("Prompt"));
export type Prompt = typeof Prompt.Type;

export const ToolName = Schema.String.pipe(Schema.brand("ToolName"));
export type ToolName = typeof ToolName.Type;

export const ToolCallId = Schema.String.pipe(Schema.brand("ToolCallId"));
export type ToolCallId = typeof ToolCallId.Type;

export const ToolOutput = Schema.String.pipe(Schema.brand("ToolOutput"));
export type ToolOutput = typeof ToolOutput.Type;

export const TokenCount = Schema.Number.check(
  Schema.isGreaterThanOrEqualTo(0),
  Schema.isInt(),
).pipe(Schema.brand("TokenCount"));
export type TokenCount = typeof TokenCount.Type;

export const FilePath = Schema.String.pipe(Schema.brand("FilePath"));
export type FilePath = typeof FilePath.Type;

export const FileContents = Schema.String.pipe(Schema.brand("FileContents"));
export type FileContents = typeof FileContents.Type;

export const ShellCommand = Schema.String.pipe(Schema.brand("ShellCommand"));
export type ShellCommand = typeof ShellCommand.Type;

export const SessionId = Schema.String.pipe(Schema.brand("SessionId"));
export type SessionId = typeof SessionId.Type;
