import { Effect, FileSystem, Layer, Schema, ServiceMap } from "effect";
import { Tool, Toolkit } from "effect/unstable/ai";
import { ChildProcess } from "effect/unstable/process";
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner";

export class ToolkitError extends Schema.TaggedErrorClass<ToolkitError>()("ToolkitError", {
  message: Schema.String,
  cause: Schema.Defect,
}) {
}

export const ReadFileTool = Tool.make("readFile", {
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

export const WriteFileTool = Tool.make("writeFile", {
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

export const BashTool = Tool.make("bash", {
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

export const CompleteTaskTool = Tool.make("completeTask", {
  description: "Signal that the requested task is complete",
  parameters: Schema.Struct({
    summary: Schema.String.annotate({
      description: "A concise final summary of the completed task",
    }),
  }),
  success: Schema.Void,
  failure: ToolkitError,
  failureMode: "error",
});

export const AgentExecutorTools = Toolkit.make(
  ReadFileTool,
  WriteFileTool,
  BashTool,
  CompleteTaskTool,
);

export interface AgentExecutorToolRuntimeShape {
  readonly readFile: (
    { filePath }: { filePath: string },
  ) => Effect.Effect<string, ToolkitError, never>;
  readonly writeFile: (
    { filePath, content }: { filePath: string; content: string },
  ) => Effect.Effect<void, ToolkitError, never>;
  readonly bash: (
    { command }: { command: string },
  ) => Effect.Effect<string, ToolkitError, never>;
}

export class AgentExecutorToolRuntime extends ServiceMap.Service<
  AgentExecutorToolRuntime,
  AgentExecutorToolRuntimeShape
>()("app/adapters/AgentExecutorToolRuntime") {}

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

  return AgentExecutorToolRuntime.of({ readFile, writeFile, bash });
})

export const AgentExecutorToolRuntimeService = Layer.effect(
  AgentExecutorToolRuntime,
  makeImpl,
);
