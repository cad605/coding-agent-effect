import { Effect, FileSystem, Schema } from "effect";
import { Tool, Toolkit } from "effect/unstable/ai";
import { ChildProcess } from "effect/unstable/process";
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner";

export class ReadFileFailed extends Schema.TaggedErrorClass<ReadFileFailed>()("ReadFileFailed", {
  cause: Schema.Defect,
}) {}

export class WriteFileFailed extends Schema.TaggedErrorClass<WriteFileFailed>()("WriteFileFailed", {
  cause: Schema.Defect,
}) {}

export class CommandFailed extends Schema.TaggedErrorClass<CommandFailed>()("CommandFailed", {
  cause: Schema.Defect,
}) {}

export const ToolkitFailureReason = Schema.Union([
  ReadFileFailed,
  WriteFileFailed,
  CommandFailed,
]);
export class ToolkitError extends Schema.TaggedErrorClass<ToolkitError>()("ToolkitError", {
  reason: ToolkitFailureReason,
}) {}

export const ReadFileTool = Tool.make("readFile", {
  description: "Read and return the contents of a file",
  parameters: Schema.Struct({
    filePath: Schema.String.annotate({
      description: "The path to the file to read",
    }),
  }),
  success: Schema.String,
  failure: ToolkitError,
  failureMode: "return",
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
  success: Schema.String,
  failure: ToolkitError,
  failureMode: "return",
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
  failureMode: "return",
});

export const AgentExecutorTools = Toolkit.make(
  ReadFileTool,
  WriteFileTool,
  BashTool,
);

export const AgentExecutorToolsService = AgentExecutorTools.toLayer(Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem;
  const spawner = yield* ChildProcessSpawner;

  const readFile = Effect.fn("toolkit.readFile")(
    function*({ filePath }: { filePath: string }) {
      yield* Effect.logDebug("Reading file", { filePath });

      return yield* fs.readFileString(filePath);
    },
    Effect.catch((cause) => Effect.fail(new ToolkitError({ reason: new ReadFileFailed({ cause }) }))),
  );

  const writeFile = Effect.fn("toolkit.writeFile")(
    function*({ filePath, content }: { filePath: string; content: string }) {
      yield* Effect.logDebug("Writing file", { filePath, content });

      yield* fs.writeFileString(filePath, content);

      return "File written successfully.";
    },
    Effect.catch((cause) => Effect.fail(new ToolkitError({ reason: new WriteFileFailed({ cause }) }))),
  );

  const bash = Effect.fn("tools.bash")(
    function*({ command }: { command: string }) {
      yield* Effect.logDebug("Executing command", { command });

      return yield* spawner.string(ChildProcess.make(command, { shell: true }), {
        includeStderr: true,
      });
    },
    Effect.catch((cause) => Effect.fail(new ToolkitError({ reason: new CommandFailed({ cause }) }))),
  );

  return AgentExecutorTools.of({
    readFile,
    writeFile,
    bash,
  });
}));
