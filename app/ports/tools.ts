import { Schema } from "effect";
import { Tool, Toolkit } from "effect/unstable/ai";

export const ReadTool = Tool.make("ReadFile", {
  description: "Read and return the contents of a file",
  parameters: Schema.Struct({
    filePath: Schema.String.annotate({
      description: "The path to the file to read",
    }),
  }),
  success: Schema.String,
  failureMode: "error",
});

export const Tools = Toolkit.make(ReadTool);
