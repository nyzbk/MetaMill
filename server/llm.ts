import OpenAI from "openai";
import type { LlmSetting } from "@shared/schema";

const openrouterClient = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL,
});

const openaiClient = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface LlmGenerateOptions {
  systemPrompt: string;
  userPrompt: string;
  jsonMode?: boolean;
  maxTokens?: number;
}

export const AVAILABLE_MODELS = [
  { provider: "openrouter", modelId: "meta-llama/llama-3.3-70b-instruct", displayName: "Llama 3.3 70B" },
  { provider: "openrouter", modelId: "qwen/qwen3-max", displayName: "Qwen 3 Max" },
  { provider: "openrouter", modelId: "mistralai/mistral-large-2512", displayName: "Mistral Large" },
  { provider: "openrouter", modelId: "deepseek/deepseek-v3.2", displayName: "DeepSeek V3.2" },
  { provider: "openrouter", modelId: "x-ai/grok-4.1-fast", displayName: "Grok 4.1 Fast" },
  { provider: "openrouter", modelId: "z-ai/glm-4.7", displayName: "GLM 4.7" },
  { provider: "openrouter", modelId: "google/gemini-2.5-flash-preview-09-2025", displayName: "Gemini 2.5 Flash" },
  { provider: "openai", modelId: "gpt-5-mini", displayName: "GPT-5 Mini" },
  { provider: "anthropic", modelId: "claude-sonnet-4-20250514", displayName: "Claude Sonnet 4" },
  { provider: "google", modelId: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro" },
  { provider: "xai", modelId: "grok-3", displayName: "Grok 3" },
  { provider: "ollama", modelId: "llama3.3", displayName: "Ollama Llama 3.3" },
  { provider: "ollama", modelId: "qwen2.5", displayName: "Ollama Qwen 2.5" },
  { provider: "ollama", modelId: "mistral", displayName: "Ollama Mistral" },
  { provider: "ollama", modelId: "deepseek-r1", displayName: "Ollama DeepSeek R1" },
  { provider: "ollama", modelId: "gemma2", displayName: "Ollama Gemma 2" },
  { provider: "ollama", modelId: "phi3", displayName: "Ollama Phi 3" },
];

type LlmSettingLike = LlmSetting | { provider: string; modelId: string; apiKey?: string | null; baseUrl?: string | null };

function getClientForProvider(setting: LlmSettingLike): OpenAI {
  const provider = setting.provider;
  const apiKey = setting.apiKey;
  const baseUrl = (setting as any).baseUrl;

  switch (provider) {
    case "openrouter":
      return openrouterClient;
    case "openai":
      if (apiKey) {
        return new OpenAI({ apiKey });
      }
      return openaiClient;
    case "anthropic":
      if (!apiKey) throw new Error("API ключ Anthropic не настроен");
      return new OpenAI({
        apiKey,
        baseURL: "https://api.anthropic.com/v1/",
      });
    case "google":
      if (!apiKey) throw new Error("API ключ Google не настроен");
      return new OpenAI({
        apiKey,
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      });
    case "xai":
      if (!apiKey) throw new Error("API ключ xAI не настроен");
      return new OpenAI({
        apiKey,
        baseURL: "https://api.x.ai/v1",
      });
    case "ollama": {
      const ollamaUrl = baseUrl || "http://localhost:11434/v1";
      return new OpenAI({
        apiKey: "ollama",
        baseURL: ollamaUrl,
      });
    }
    case "custom": {
      if (!baseUrl) throw new Error("Base URL для кастомного провайдера не указан");
      return new OpenAI({
        apiKey: apiKey || "no-key",
        baseURL: baseUrl,
      });
    }
    default:
      return openrouterClient;
  }
}

export async function generateWithLlm(
  setting: LlmSettingLike,
  options: LlmGenerateOptions
): Promise<string> {
  const client = getClientForProvider(setting);

  const createOptions: any = {
    model: setting.modelId,
    messages: [
      { role: "system", content: options.systemPrompt },
      { role: "user", content: options.userPrompt },
    ],
    max_tokens: options.maxTokens || 8192,
  };

  if (options.jsonMode && setting.provider !== "anthropic" && setting.provider !== "ollama") {
    createOptions.response_format = { type: "json_object" };
  }

  const response = await client.chat.completions.create(createOptions);
  return response.choices[0]?.message?.content || "";
}
