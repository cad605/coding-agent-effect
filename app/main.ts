import {
	OpenRouterClient,
	OpenRouterLanguageModel,
} from "@effect/ai-openrouter";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Config, Console, Effect, Layer, Schema, ServiceMap } from "effect";
import { AiError, LanguageModel, Tool, Toolkit } from "effect/unstable/ai";
import { Command, Flag } from "effect/unstable/cli";
import { FetchHttpClient } from "effect/unstable/http";
import { AppConfig } from "./domains/app-config.ts";

const ReadTool = Tool.make("read", {
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
		yield* Effect.logDebug("Initializing tools...");
		return Tools.of({
			read: Effect.fn("Tools.read")(function* ({
				filePath,
			}: {
				filePath: string;
			}) {
				yield* Effect.logDebug("Reading file...", { filePath });
				return "Hello, world!";
			}),
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

// Wrap tool-enabled generation in a service
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
			// Access the toolkit's handlers by yielding the toolkit definition.
			const toolkit = yield* Tools;

			// Choose a model to use
			const model = yield* OpenRouterLanguageModel.model(
				"anthropic/claude-haiku-4.5",
			);

			const answer = Effect.fn("Assistant.answer")(
				function* (question: string) {
					// Pass the toolkit to `generateText`. The model can call any tool in
					// the toolkit; the framework resolves parameters, invokes handlers,
					// and feeds results back automatically.
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
				// Provide the chosen model to use
				Effect.provide(model),
				// Map AI errors into our domain error type
				Effect.catchTag(
					"AiError",
					(error) =>
						Effect.fail(
							new AssistantError({
								reason: error.reason,
							}),
						),
					// For unexpected errors, die with the original error
					(e) => Effect.die(e),
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

		const { text } = yield* assistant.answer(prompt);

		yield* Console.log(text);
	}),
).pipe(Command.withDescription("CodeCrafters Assistant"));

const program = Command.run(assistant, {
	version: "1.0.0",
});

// Compose all layers into a single app layer
const appLayer = AppConfig.layer.pipe(
	Layer.provideMerge(Assistant.layer),
	Layer.provideMerge(OpenRouter),
	Layer.provideMerge(ToolsLayer),
	Layer.provideMerge(BunServices.layer),
);

program.pipe(Effect.provide(appLayer), BunRuntime.runMain);
