import type { ClassifyContext, ClassifyFn, ProviderName } from "../types";
import { SYSTEM_PROMPT, userMessage } from "../prompt";
import { extractJsonObject } from "./normalize";
import { ProviderError, providerFetch } from "./http";

export interface ProviderSettings {
  provider: ProviderName;
  maxTokens: number;
  groqApiKey: string;
  groqModel: string;
  groqBaseUrl: string;
  geminiApiKey: string;
  geminiModel: string;
  openaiApiKey: string;
  openaiModel: string;
  openaiBaseUrl: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
}

function completionKeys(payload: unknown): string[] {
  const choices = (payload as { choices?: Array<{ message?: { content?: string | null } }> }).choices;
  const content = choices?.[0]?.message?.content;
  if (typeof content !== "string") return [];
  try {
    const parsed = extractJsonObject(content);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
    return Object.keys(parsed);
  } catch {
    return [];
  }
}

function logGroqOriginal(chunkId: string, body: Record<string, unknown>, payload: unknown): void {
  const message = (body.messages as Array<{ content?: string }> | undefined)?.[0]?.content ?? "";
  const instruction = message.split("\n\n")[0] ?? "";
  const record = payload as { model?: unknown; usage?: unknown };
  console.log(JSON.stringify({
    event: "groq_original",
    chunk_id: chunkId,
    response_model: typeof record.model === "string" ? record.model : null,
    request: {
      model: body.model,
      temperature: body.temperature,
      max_completion_tokens: body.max_completion_tokens,
      response_format: body.response_format,
      reasoning_effort: body.reasoning_effort ?? null,
      reasoning_format: body.reasoning_format ?? null,
    },
    includes_ten_word_limit: instruction.includes("<=10 words"),
    output_keys: completionKeys(payload),
    usage: record.usage ?? null,
  }));
}

function messageText(payload: unknown, read: (value: unknown) => string | undefined): string {
  const text = read(payload);
  if (!text || text.trim() === "") throw new ProviderError("Provider returned an empty completion");
  return text;
}

async function completeGroq(settings: ProviderSettings, context: ClassifyContext, signal: AbortSignal): Promise<unknown> {
  const body: Record<string, unknown> = {
    model: settings.groqModel,
    messages: [{ role: "user", content: `${SYSTEM_PROMPT}\n\n${userMessage(context)}` }],
    temperature: 0,
    max_completion_tokens: settings.maxTokens,
    response_format: { type: "json_object" },
  };
  if (settings.groqModel.includes("gpt-oss")) {
    body.reasoning_effort = "low";
    body.reasoning_format = "hidden";
  } else if (settings.groqModel.includes("qwen")) {
    body.reasoning_effort = "none";
    body.reasoning_format = "hidden";
  }

  const payload = await providerFetch(`${settings.groqBaseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.groqApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });
  logGroqOriginal(context.chunk.chunk_id, body, payload);
  const text = messageText(payload, (value) => {
    const choices = (value as { choices?: Array<{ message?: { content?: string | null } }> }).choices;
    const content = choices?.[0]?.message?.content;
    return typeof content === "string" ? content : undefined;
  });
  return extractJsonObject(text);
}

async function completeOpenAI(settings: ProviderSettings, context: ClassifyContext, signal: AbortSignal): Promise<unknown> {
  const body: Record<string, unknown> = {
    model: settings.openaiModel,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage(context) },
    ],
    max_completion_tokens: settings.maxTokens,
    response_format: { type: "json_object" },
  };
  if (usesReasoning(settings.openaiModel)) body.reasoning_effort = "minimal";
  else body.temperature = 0;

  const payload = await providerFetch(`${settings.openaiBaseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });
  const text = messageText(payload, (value) => {
    const choices = (value as { choices?: Array<{ message?: { content?: string | null } }> }).choices;
    const content = choices?.[0]?.message?.content;
    return typeof content === "string" ? content : undefined;
  });
  return extractJsonObject(text);
}

function usesReasoning(model: string): boolean {
  return /^(gpt-5|o1|o3|o4)/.test(model);
}

async function completeGemini(settings: ProviderSettings, context: ClassifyContext, signal: AbortSignal): Promise<unknown> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${settings.geminiModel}:generateContent?key=${encodeURIComponent(settings.geminiApiKey)}`;
  const payload = await providerFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: userMessage(context) }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: settings.maxTokens,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: "minimal" },
      },
    }),
    signal,
  });
  const text = messageText(payload, (value) => {
    const parts = (value as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates?.[0]?.content?.parts;
    if (!parts) return undefined;
    return parts.map((part) => part.text ?? "").join("");
  });
  return extractJsonObject(text);
}

async function completeOllama(settings: ProviderSettings, context: ClassifyContext, signal: AbortSignal): Promise<unknown> {
  const payload = await providerFetch(`${settings.ollamaBaseUrl.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: settings.ollamaModel,
      stream: false,
      format: "json",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage(context) },
      ],
      options: { temperature: 0, num_predict: settings.maxTokens },
    }),
    signal,
  });
  const text = messageText(payload, (value) => {
    const content = (value as { message?: { content?: string } }).message?.content;
    return typeof content === "string" ? content : undefined;
  });
  return extractJsonObject(text);
}

export function buildClassifier(settings: ProviderSettings): ClassifyFn | null {
  if (settings.provider === "fallback") return null;
  return (context, signal) => {
    if (settings.provider === "groq") return completeGroq(settings, context, signal);
    if (settings.provider === "gemini") return completeGemini(settings, context, signal);
    if (settings.provider === "openai") return completeOpenAI(settings, context, signal);
    return completeOllama(settings, context, signal);
  };
}
