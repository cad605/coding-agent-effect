import { Effect, FileSystem } from "effect";

import { Tools } from "../ports/tools.ts";

export const FileSystemToolsLive = Tools.toLayer(
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;

    return Tools.of({
      ReadFile: Effect.fn("Tools.ReadFile")(
        function* ({ filePath }: { filePath: string }) {
          return yield* fs.readFileString(filePath);
        },

        Effect.catch(() => Effect.succeed("Error reading file")),
      ),
    });
  }),
);
