import type { ProviderName } from "./types";
import type { ProviderSettings } from "./llm/classify";

export interface AppConfig extends ProviderSettings {
  port: number;
  timeoutMs: number;
  cacheMax: number;
}

function integer(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function resolveProvider(env: NodeJS.ProcessEnv): ProviderName {
  const requested = env.LLM_PROVIDER?.trim().toLowerCase();
  const groq = Boolean(env.GROQ_API_KEY?.trim());
  const gemini = Boolean(env.GEMINI_API_KEY?.trim());
  const openai = Boolean(env.OPENAI_API_KEY?.trim());

  if (requested === "fallback") return "fallback";
  if (requested === "groq") return groq ? "groq" : "fallback";
  if (requested === "gemini") return gemini ? "gemini" : "fallback";
  if (requested === "openai") return openai ? "openai" : "fallback";
  if (requested === "ollama") return "ollama";
  if (groq) return "groq";
  if (gemini) return "gemini";
  return "ollama";
}

export function activeModel(config: AppConfig): string | null {
  if (config.provider === "groq") return config.groqModel;
  if (config.provider === "gemini") return config.geminiModel;
  if (config.provider === "openai") return config.openaiModel;
  if (config.provider === "ollama") return config.ollamaModel;
  return null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: integer(env.PORT, 3000),
    provider: resolveProvider(env),
    timeoutMs: integer(env.LLM_TIMEOUT_MS, 420),
    maxTokens: integer(env.LLM_MAX_TOKENS, 160),
    cacheMax: integer(env.CACHE_MAX, 500),
    groqApiKey: env.GROQ_API_KEY?.trim() ?? "",
    groqModel: env.GROQ_MODEL?.trim() || "qwen/qwen3.8-27b",
    groqBaseUrl: env.GROQ_BASE_URL?.trim() || "https://api.groq.com/openai/v1",
    geminiApiKey: env.GEMINI_API_KEY?.trim() ?? "",
    geminiModel: env.GEMINI_MODEL?.trim() || "gemini-3.1-flash-lite",
    openaiApiKey: env.OPENAI_API_KEY?.trim() ?? "",
    openaiModel: env.OPENAI_MODEL?.trim() || "gpt-4.1-nano",
    openaiBaseUrl: env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1",
    ollamaBaseUrl: env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434",
    ollamaModel: env.OLLAMA_MODEL?.trim() || "llama3.2:3b",
  };
}
