import type { RiskLevel, Sentiment, StoredChunk } from "./types";
import type { Features } from "./types";

const RANK: Record<RiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function sentimentFamily(sentiment: Sentiment): "warm" | "hostile" | "evasive" | "flat" {
  if (sentiment === "positive") return "warm";
  if (sentiment === "aggressive" || sentiment === "sarcastic" || sentiment === "negative") return "hostile";
  if (sentiment === "deflecting" || sentiment === "appeasement") return "evasive";
  return "flat";
}

export function ruleRisk(sentiment: Sentiment, volatility: boolean): RiskLevel {
  if (sentiment === "aggressive" && volatility) return "critical";
  if (
    sentiment === "aggressive" ||
    sentiment === "sarcastic" ||
    (sentiment === "negative" && volatility) ||
    (sentiment === "deflecting" && volatility)
  ) {
    return "high";
  }
  if (sentiment === "deflecting" || sentiment === "appeasement" || sentiment === "negative" || volatility) {
    return "medium";
  }
  return "low";
}

export function stricter(left: RiskLevel, right: RiskLevel): RiskLevel {
  return RANK[left] >= RANK[right] ? left : right;
}

export function isVolatile(input: {
  features: Features;
  sentiment: Sentiment;
  previous: StoredChunk | null;
  timestampMs: number;
}): boolean {
  const acousticSpike = input.features.pitch >= 0.75 || input.features.wpm >= 185 || input.features.volume >= 0.8;
  if (!input.previous) return acousticSpike;

  const close = Math.abs(input.timestampMs - input.previous.timestamp_ms) <= 20_000;
  const arousalJump = Math.abs(input.features.arousal - input.previous.arousal) >= 0.28;
  const toneBreak = sentimentFamily(input.sentiment) !== sentimentFamily(input.previous.sentiment);
  return acousticSpike || (close && arousalJump && toneBreak);
}
