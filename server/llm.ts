import OpenAI from "openai";
import type { LlmSetting } from "@shared/schema";

// Lazy load OpenAI client to prevent startup crash if keys are missing
function getOpenAIClient() {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!apiKey) return null;

  return new OpenAI({
    apiKey,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
}

const openaiClient = getOpenAIClient();

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
  { provider: "groq", modelId: "meta-llama/llama-4-scout-17b-16e-instruct", displayName: "Llama 4 Scout (Groq)" },
  { provider: "groq", modelId: "meta-llama/llama-3.3-70b-versatile", displayName: "Llama 3.3 70B (Groq)" },
  { provider: "groq", modelId: "qwen/qwen3-32b", displayName: "Qwen 3 32B (Groq)" },
  { provider: "groq", modelId: "moonshotai/kimi-k2-instruct", displayName: "Kimi K2 (Groq)" },
  { provider: "groq", modelId: "openai/gpt-oss-120b", displayName: "GPT OSS 120B (Groq)" },
  { provider: "groq", modelId: "openai/gpt-oss-20b", displayName: "GPT OSS 20B (Groq)" },
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
      if (!apiKey) throw new Error("API ключ OpenRouter не настроен. Добавьте свой ключ в настройках (openrouter.ai)");
      return new OpenAI({
        apiKey,
        baseURL: "https://openrouter.ai/api/v1",
      });
    case "groq":
      if (!apiKey) throw new Error("API ключ Groq не настроен. Добавьте свой ключ в настройках (console.groq.com)");
      return new OpenAI({
        apiKey,
        baseURL: "https://api.groq.com/openai/v1",
      });
    case "openai":
      if (apiKey) {
        return new OpenAI({ apiKey });
      }
      const defaultClient = getOpenAIClient();
      if (!defaultClient) throw new Error("API ключ OpenAI не настроен в переменных окружения");
      return defaultClient;
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
      throw new Error(`Неизвестный провайдер: ${provider}. Настройте провайдер в разделе Настройки.`);
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

  if (options.jsonMode && setting.provider !== "anthropic" && setting.provider !== "ollama" && setting.provider !== "groq") {
    createOptions.response_format = { type: "json_object" };
  }

  const response = await client.chat.completions.create(createOptions);
  return response.choices[0]?.message?.content || "";
}
