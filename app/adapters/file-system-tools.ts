import { Effect, FileSystem } from "effect";

import { Tools } from "../ports/tools.ts";

const readFile = Effect.fn("Tools.ReadFile")(
  function* ({ filePath }: { filePath: string }) {
    const fs = yield* FileSystem.FileSystem;

    return yield* fs.readFileString(filePath);
  },

  Effect.catch(() => Effect.succeed("Error reading file")),
);

const writeFile = Effect.fn("Tools.WriteFile")(
  function* ({ filePath, content }: { filePath: string; content: string }) {
    const fs = yield* FileSystem.FileSystem;

    yield* fs.writeFileString(filePath, content);

    return "File written successfully";
  },

  Effect.catch(() => Effect.succeed("Error writing file")),
);

export const FileSystemToolsLive = Tools.toLayer(
  Tools.of({
    ReadFile: readFile,
    WriteFile: writeFile,
  }),
);
