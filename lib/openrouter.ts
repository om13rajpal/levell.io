import { createOpenRouter } from "@openrouter/ai-sdk-provider";

// Model mapping from internal format to OpenRouter model IDs
const MODEL_MAP: Record<string, string> = {
  // OpenAI models
  "gpt-4o": "openai/gpt-4o",
  "gpt-4o-mini": "openai/gpt-4o-mini",
  "gpt-4-turbo": "openai/gpt-4-turbo",
  "gpt-3.5-turbo": "openai/gpt-3.5-turbo",

  // Anthropic models
  "claude-sonnet-4.5": "anthropic/claude-sonnet-4.5",
  "claude-3-5-sonnet-latest": "anthropic/claude-3.5-sonnet",
  "claude-3-5-haiku-latest": "anthropic/claude-3.5-haiku",
  "claude-3-opus": "anthropic/claude-3-opus",
  "claude-3-sonnet": "anthropic/claude-3-sonnet",

  // Google models
  "gemini-2.0-flash-exp": "google/gemini-2.0-flash-exp:free",
  "gemini-1.5-pro": "google/gemini-pro-1.5",
  "gemini-1.5-flash": "google/gemini-flash-1.5",

  // Perplexity models
  "sonar-pro": "perplexity/sonar-pro",
  "sonar": "perplexity/sonar",
  "sonar-reasoning": "perplexity/sonar-reasoning",
};

/**
 * Get the OpenRouter model ID from the internal model format
 */
export function getOpenRouterModelId(modelId: string): string {
  const [provider, model] = modelId.split("/");
  const modelName = model || provider;

  // Check if we have a direct mapping
  if (MODEL_MAP[modelName]) {
    return MODEL_MAP[modelName];
  }

  // Handle provider/model format
  if (modelId.includes("/")) {
    switch (provider) {
      case "openai":
        return `openai/${model}`;
      case "anthropic":
        if (model === "claude-sonnet-4.5") return "anthropic/claude-sonnet-4.5";
        if (model === "claude-3-5-sonnet-latest") return "anthropic/claude-3.5-sonnet";
        if (model === "claude-3-5-haiku-latest") return "anthropic/claude-3.5-haiku";
        return `anthropic/${model}`;
      case "google":
        if (model === "gemini-2.0-flash-exp") return "google/gemini-2.0-flash-exp:free";
        return `google/${model}`;
      case "perplexity":
        return `perplexity/${model}`;
      default:
        return modelId;
    }
  }

  return modelId;
}

/**
 * Get the model instance routed through OpenRouter
 */
export function getOpenRouterModel(modelId: string) {
  const openRouterModelId = getOpenRouterModelId(modelId);

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set in environment variables");
  }

  const openrouter = createOpenRouter({
    apiKey: apiKey,
  });

  return openrouter(openRouterModelId);
}
