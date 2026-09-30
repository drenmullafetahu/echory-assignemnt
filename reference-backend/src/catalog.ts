import type { AppConfig } from "./config";
import { activeModel } from "./config";
import type { ProviderName } from "./types";

export interface ProviderChoice {
  id: ProviderName;
  label: string;
  available: boolean;
  models: string[];
}

const PRESETS: Record<Exclude<ProviderName, "fallback">, readonly string[]> = {
  groq: ["qwen/qwen3.8-27b", "openai/gpt-oss-20b"],
  openai: ["gpt-4.1-nano", "gpt-4.1-mini", "gpt-5-nano"],
  gemini: ["gemini-3.1-flash-lite"],
  ollama: ["llama3.2:3b", "llama3.2:1b"],
};

export async function providerChoices(config: AppConfig): Promise<ProviderChoice[]> {
  const installed = await ollamaModels(config.ollamaBaseUrl);
  return [
    choice("groq", "Groq", Boolean(config.groqApiKey), unique([...PRESETS.groq, config.groqModel])),
    choice("openai", "OpenAI", Boolean(config.openaiApiKey), unique([...PRESETS.openai, config.openaiModel])),
    choice("gemini", "Gemini", Boolean(config.geminiApiKey), unique([...PRESETS.gemini, config.geminiModel])),
    choice("ollama", "Ollama", installed !== null, unique([...PRESETS.ollama, ...(installed ?? []), config.ollamaModel])),
    choice("fallback", "Heuristic", true, []),
  ];
}

export function activeSelection(config: AppConfig): { provider: ProviderName; model: string | null } {
  return { provider: config.provider, model: activeModel(config) };
}

function choice(id: ProviderName, label: string, available: boolean, models: string[]): ProviderChoice {
  return { id, label, available, models };
}

function unique(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

async function ollamaModels(baseUrl: string): Promise<string[] | null> {
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/tags`, { signal: AbortSignal.timeout(800) });
    if (!response.ok) return null;
    const body = await response.json() as { models?: Array<{ name?: unknown }> };
    const names = (body.models ?? [])
      .map((model) => (typeof model.name === "string" ? model.name.trim() : ""))
      .filter((name) => name.length > 0);
    return names;
  } catch {
    return null;
  }
}
