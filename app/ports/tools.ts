import { Schema, FileSystem } from "effect";
import { Tool, Toolkit } from "effect/unstable/ai";

export const ReadFile = Tool.make("ReadFile", {
  description: "Read and return the contents of a file",
  parameters: Schema.Struct({
    filePath: Schema.String.annotate({
      description: "The path to the file to read",
    }),
  }),
  success: Schema.String,
  failureMode: "error",
  dependencies: [FileSystem.FileSystem],
});

export const WriteFile = Tool.make("WriteFile", {
  description: "Write content to a file",
  parameters: Schema.Struct({
    filePath: Schema.String.annotate({
      description: "The path to the file to write",
    }),
    content: Schema.String.annotate({
      description: "The contents to write to the file",
    }),
  }),
  success: Schema.String,
  failureMode: "error",
  dependencies: [FileSystem.FileSystem],
});

export const Tools = Toolkit.make(ReadFile, WriteFile);
