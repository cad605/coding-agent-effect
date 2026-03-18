import { Effect, FileSystem } from "effect";
import { ChildProcess } from "effect/unstable/process";
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner";

import { Tools } from "../ports/tools.ts";

const readFile = Effect.fn("tools.readFile")(
  function* ({ filePath }: { filePath: string }) {
    const fs = yield* FileSystem.FileSystem;

    return yield* fs.readFileString(filePath);
  },

  Effect.catch(() => Effect.succeed("Error reading file")),
);

const writeFile = Effect.fn("tools.writeFile")(
  function* ({ filePath, content }: { filePath: string; content: string }) {
    const fs = yield* FileSystem.FileSystem;

    yield* fs.writeFileString(filePath, content);

    return "File written successfully";
  },

  Effect.catch(() => Effect.succeed("Error writing file")),
);

const bash = Effect.fn("tools.bash")(
  function* ({ command }: { command: string }) {
    const spawner = yield* ChildProcessSpawner;

    const response = yield* spawner.string(ChildProcess.make(command, { shell: true }), {
      includeStderr: true,
    });

    return response;
  },

  Effect.catch(() => Effect.succeed("Error executing command")),
);

export const ToolsLive = Tools.toLayer(
  Effect.gen(function* () {
    yield* Effect.logDebug("Initializing tools...");

    return Tools.of({
      readFile,
      writeFile,
      bash,
    });
  }),
);
