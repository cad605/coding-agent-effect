import {
	OpenRouterClient,
	OpenRouterLanguageModel,
} from "@effect/ai-openrouter";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import {
	Config,
	Console,
	Effect,
	FileSystem,
	Layer,
	Schema,
	ServiceMap,
} from "effect";
import { AiError, LanguageModel, Tool, Toolkit } from "effect/unstable/ai";
import { Command, Flag } from "effect/unstable/cli";
import { FetchHttpClient } from "effect/unstable/http";
import { AppConfig } from "./domains/app-config.ts";

const ReadTool = Tool.make("ReadFile", {
	description: "Read and return the contents of a file",
	parameters: Schema.Struct({
		filePath: Schema.String.annotate({
			description: "The path to the file to read",
		}),
	}),
	success: Schema.String,
	failureMode: "error",
});

const Tools = Toolkit.make(ReadTool);

const ToolsLayer = Tools.toLayer(
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;

		return Tools.of({
			ReadFile: Effect.fn("Tools.ReadFile")(
				function* ({ filePath }: { filePath: string }) {
					return yield* fs.readFileString(filePath);
				},

				Effect.catch((error) => Effect.die(error)),
			),
		});
	}),
);

const OpenRouter = OpenRouterClient.layerConfig({
	apiKey: Config.redacted("OPENROUTER_API_KEY"),
	apiUrl: Config.withDefault(
		Config.string("OPENROUTER_BASE_URL"),
		"https://openrouter.ai/api/v1",
	),
}).pipe(Layer.provide(FetchHttpClient.layer));

export class AssistantError extends Schema.TaggedErrorClass<AssistantError>()(
	"AssistantError",
	{ reason: AiError.AiErrorReason },
) {}

export class Assistant extends ServiceMap.Service<
	Assistant,
	{
		answer(question: string): Effect.Effect<
			{
				readonly text: string;
				readonly toolCallCount: number;
			},
			AssistantError
		>;
	}
>()("@codecrafters/claude-code/Assistant") {
	static readonly layer = Layer.effect(
		Assistant,
		Effect.gen(function* () {
			const toolkit = yield* Tools;

			const model = yield* OpenRouterLanguageModel.model(
				"anthropic/claude-haiku-4.5",
			);

			const answer = Effect.fn("Assistant.answer")(
				function* (question: string) {
					const { text, toolCalls } = yield* LanguageModel.generateText({
						prompt: question,
						toolkit,
						toolChoice: "auto",
					});

					return {
						text,
						toolCallCount: toolCalls.length,
					};
				},

				Effect.provide(model),

				Effect.catchTag(
					"AiError",
					(error) =>
						Effect.fail(
							new AssistantError({
								reason: error.reason,
							}),
						),

					(error) => Effect.die(error),
				),
			);

			return Assistant.of({ answer });
		}),
	);
}

const prompt = Flag.string("prompt").pipe(
	Flag.withAlias("p"),
	Flag.withDescription("Prompt to operate on"),
	Flag.withDefault(
		"How many tools are available to you in this request? Number only.",
	),
);

const assistant = Command.make("assistant", { prompt }, ({ prompt }) =>
	Effect.gen(function* () {
		const assistant = yield* Assistant;

		yield* Effect.logDebug("Prompting assistant...", { prompt });

		const { text } = yield* assistant.answer(prompt);

		yield* Console.log(text);
	}),
).pipe(Command.withDescription("CodeCrafters Assistant"));

const program = Command.run(assistant, {
	version: "1.0.0",
});

const appLayer = AppConfig.layer.pipe(
	Layer.provideMerge(Assistant.layer),
	Layer.provideMerge(OpenRouter),
	Layer.provideMerge(ToolsLayer),
	Layer.provideMerge(BunServices.layer),
);

program.pipe(Effect.provide(appLayer), BunRuntime.runMain);
