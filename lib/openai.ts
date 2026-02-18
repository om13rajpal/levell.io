import { createOpenAI } from "@ai-sdk/openai";

// Supported OpenAI models
const OPENAI_MODELS = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "gpt-3.5-turbo",
  "o1",
  "o1-mini",
  "o1-preview",
];

/**
 * Get the OpenAI model ID from the internal model format
 * Accepts formats like "gpt-4o", "openai/gpt-4o", etc.
 */
export function getOpenAIModelId(modelId: string): string {
  // Handle provider/model format (e.g., "openai/gpt-4o")
  if (modelId.includes("/")) {
    const [, model] = modelId.split("/");
    return model;
  }
  return modelId;
}

/**
 * Get the OpenAI model instance
 */
export function getOpenAIModel(modelId: string) {
  const openAIModelId = getOpenAIModelId(modelId);

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set in environment variables");
  }

  const openai = createOpenAI({
    apiKey: apiKey,
  });

  return openai(openAIModelId);
}
