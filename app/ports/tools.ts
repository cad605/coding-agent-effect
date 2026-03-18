import { Schema, FileSystem } from "effect";
import { Tool, Toolkit } from "effect/unstable/ai";
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner";

export const ReadFile = Tool.make("readFile", {
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

export const WriteFile = Tool.make("writeFile", {
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

export const Bash = Tool.make("bash", {
  description: "Execute a shell command",
  parameters: Schema.Struct({
    command: Schema.String.annotate({
      description: "The command to execute",
    }),
  }),
  success: Schema.String,
  failureMode: "error",
  dependencies: [ChildProcessSpawner],
});

export const Tools = Toolkit.make(ReadFile, WriteFile, Bash);
