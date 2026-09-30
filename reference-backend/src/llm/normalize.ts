import type { Draft, RiskLevel, Sentiment } from "../types";
import { ruleRisk } from "../risk";
import { roundConfidence, toIntent, truncate } from "../text";

const SENTIMENT_ALIASES: Record<string, Sentiment> = {
  positive: "positive",
  negative: "negative",
  neutral: "neutral",
  sarcastic: "sarcastic",
  sarcasm: "sarcastic",
  aggressive: "aggressive",
  aggression: "aggressive",
  deflecting: "deflecting",
  deflection: "deflecting",
  appeasement: "appeasement",
  appeasing: "appeasement",
};

const RISK_ALIASES: Record<string, RiskLevel> = {
  low: "low",
  medium: "medium",
  moderate: "medium",
  high: "high",
  critical: "critical",
  severe: "critical",
};

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced?.[1]?.trim() ?? trimmed;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start === -1 || end <= start) {
      throw new Error("Model response did not contain a JSON object");
    }
    return JSON.parse(body.slice(start, end + 1)) as unknown;
  }
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function field(record: Record<string, unknown>, shortKey: string, longKey: string): unknown {
  if (Object.prototype.hasOwnProperty.call(record, shortKey)) return record[shortKey];
  return record[longKey];
}

export function normalizeModelOutput(payload: unknown): Draft {
  if (!payload || typeof payload !== "object") {
    throw new Error("Model JSON was not an object");
  }
  const record = payload as Record<string, unknown>;
  const sentimentValue = field(record, "s", "sentiment");
  const sentiment = SENTIMENT_ALIASES[String(sentimentValue ?? "").trim().toLowerCase()];
  if (!sentiment) throw new Error(`Unknown sentiment: ${String(sentimentValue)}`);

  const riskValue = field(record, "r", "risk_level");
  const risk = RISK_ALIASES[String(riskValue ?? "").trim().toLowerCase()] ?? ruleRisk(sentiment, false);
  const intentValue = field(record, "i", "hidden_intent");
  const mitigationValue = field(record, "m", "mitigation_suggestion");
  const intentSource = typeof intentValue === "string" ? intentValue : "unspecified_intent";
  const mitigationSource = typeof mitigationValue === "string" ? mitigationValue : "";

  return {
    sentiment,
    confidence: roundConfidence(asNumber(field(record, "c", "confidence")) ?? 0.6),
    modelVolatility: asBoolean(field(record, "v", "volatility_flag")) ?? false,
    hiddenIntent: toIntent(intentSource),
    mitigation: truncate(mitigationSource || "Ask them to be specific before you concede.", 120),
    modelRisk: risk,
    source: "llm",
  };
}
