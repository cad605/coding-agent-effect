import { Effect, FileSystem, Layer, Schema, ServiceMap } from "effect";
import { Tool, Toolkit } from "effect/unstable/ai";
import { ChildProcess } from "effect/unstable/process";
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner";

export class ReadFileFailed extends Schema.TaggedErrorClass<ReadFileFailed>()("ReadFileFailed", {
  filePath: Schema.String,
  cause: Schema.Defect,
}) {}

export class WriteFileFailed extends Schema.TaggedErrorClass<WriteFileFailed>()("WriteFileFailed", {
  filePath: Schema.String,
  cause: Schema.Defect,
}) {}

export class CommandFailed extends Schema.TaggedErrorClass<CommandFailed>()("CommandFailed", {
  command: Schema.String,
  cause: Schema.Defect,
}) {}

export const ToolkitFailureReason = Schema.Union([
  ReadFileFailed,
  WriteFileFailed,
  CommandFailed,
]);

const formatToolkitFailure = (
  reason: ReadFileFailed | WriteFileFailed | CommandFailed,
): string => {
  switch (reason._tag) {
    case "ReadFileFailed":
      return `Failed to read file: ${reason.filePath}`;
    case "WriteFileFailed":
      return `Failed to write file: ${reason.filePath}`;
    case "CommandFailed":
      return `Failed to execute command: ${reason.command}`;
  }
};

export class ToolkitError extends Schema.TaggedErrorClass<ToolkitError>()("ToolkitError", {
  reason: ToolkitFailureReason,
}) {
  override get message(): string {
    return formatToolkitFailure(this.reason);
  }
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

      return yield* fs.readFileString(filePath).pipe(
        Effect.catch((cause) => Effect.fail(new ToolkitError({ reason: new ReadFileFailed({ filePath, cause }) }))),
      );
    },
  );

  const writeFile = Effect.fn("toolkit.writeFile")(
    function*({ filePath, content }: { filePath: string; content: string }) {
      yield* Effect.logDebug("Writing file", { filePath, content });

      return yield* fs.writeFileString(filePath, content).pipe(
        Effect.catch((cause) => Effect.fail(new ToolkitError({ reason: new WriteFileFailed({ filePath, cause }) }))),
      );
    },
  );

  const bash = Effect.fn("tools.bash")(
    function*({ command }: { command: string }) {
      yield* Effect.logDebug("Executing command", { command });

      return yield* spawner.string(ChildProcess.make(command, { shell: true }), {
        includeStderr: true,
      }).pipe(
        Effect.catch((cause) => Effect.fail(new ToolkitError({ reason: new CommandFailed({ command, cause }) }))),
      );
    },
  );

  return AgentExecutorToolRuntime.of({ readFile, writeFile, bash });
});

export const AgentExecutorToolRuntimeService = Layer.effect(
  AgentExecutorToolRuntime,
  makeImpl,
);
