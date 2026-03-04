import { Config, Effect, Layer, type Redacted, ServiceMap } from "effect";

export class AppConfig extends ServiceMap.Service<
	AppConfig,
	{
		readonly apiKey: Redacted.Redacted;
		readonly baseUrl: string;
	}
>()("AppConfig") {
	static readonly layer = Layer.effect(
		AppConfig,
		Effect.gen(function* () {
			const apiKey = yield* Config.redacted("OPENROUTER_API_KEY");
			const baseUrl = yield* Config.string("OPENROUTER_BASE_URL");

			return AppConfig.of({
				apiKey,
				baseUrl,
			});
		}),
	);
}
