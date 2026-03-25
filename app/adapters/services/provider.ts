import { OpenRouterClient } from "@effect/ai-openrouter";
import { Config, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

export const ProviderService = OpenRouterClient.layerConfig({
  apiKey: Config.redacted("OPENROUTER_API_KEY"),
  apiUrl: Config.withDefault(Config.string("OPENROUTER_BASE_URL"), "https://openrouter.ai/api/v1"),
}).pipe(Layer.provide(FetchHttpClient.layer));
