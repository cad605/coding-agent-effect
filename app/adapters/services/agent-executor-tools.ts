import { Effect, FileSystem } from "effect";
import { ChildProcess } from "effect/unstable/process";
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner";

import { Schema } from "effect";
import { Tool, Toolkit as Tools } from "effect/unstable/ai";

export class ToolkitError extends Schema.TaggedErrorClass<ToolkitError>()("ToolkitError", {
  message: Schema.String,
  cause: Schema.Defect,
}) {
}

export const ReadFile = Tool.make("readFile", {
  description: "Read and return the contents of a file",
  parameters: Schema.Struct({
    filePath: Schema.String.annotate({
      description: "The path to the file to read",
    }),
  }),
  success: Schema.String,
  failure: ToolkitError,
  failureMode: "error",
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
  success: Schema.Void,
  failure: ToolkitError,
  failureMode: "error",
});

export const Bash = Tool.make("bash", {
  description: "Execute a shell command",
  parameters: Schema.Struct({
    command: Schema.String.annotate({
      description: "The command to execute",
    }),
  }),
  success: Schema.String,
  failure: ToolkitError,
  failureMode: "error",
});

export const AgentExecutorTools = Tools.make(ReadFile, WriteFile, Bash);

const makeImpl = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem;
  const spawner = yield* ChildProcessSpawner;

  const readFile = Effect.fn("toolkit.readFile")(
    function*({ filePath }: { filePath: string }) {
      yield* Effect.logDebug("Reading file", { filePath });

      return yield* fs.readFileString(filePath);
    },
    Effect.catch((error) => Effect.fail(new ToolkitError({ message: "Failed to read file", cause: error }))),
  );

  const writeFile = Effect.fn("toolkit.writeFile")(
    function*({ filePath, content }: { filePath: string; content: string }) {
      yield* Effect.logDebug("Writing file", { filePath, content });

      return yield* fs.writeFileString(filePath, content);
    },
    Effect.catch((error) => Effect.fail(new ToolkitError({ message: "Failed to write file", cause: error }))),
  );

  const bash = Effect.fn("tools.bash")(
    function*({ command }: { command: string }) {
      yield* Effect.logDebug("Executing command", { command });

      return yield* spawner.string(ChildProcess.make(command, { shell: true }), {
        includeStderr: true,
      });
    },
    Effect.catch((error) => Effect.fail(new ToolkitError({ message: "Failed to execute command", cause: error }))),
  );

  return AgentExecutorTools.of({ readFile, writeFile, bash });
})

export const AgentExecutorToolsService = AgentExecutorTools.toLayer(makeImpl);
