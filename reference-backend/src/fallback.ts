import type { ClassifyContext, Draft, Sentiment } from "./types";
import { sentimentFamily, ruleRisk } from "./risk";
import { clamp } from "./text";

const MITIGATION: Record<Sentiment, string> = {
  sarcastic: "Ignore the compliment and ask them to commit to a specific date.",
  deflecting: "Name the delay and ask for a decision date before you move on.",
  aggressive: "Slow your pace, acknowledge the pressure, and narrow to one issue.",
  appeasement: "Accept the opening and lock one specific concession before continuing.",
  negative: "Repeat their concern in their words before you answer it.",
  positive: "Confirm the alignment and name the next concrete step.",
  neutral: "Ask one open question that asks for a specific commitment.",
};

const INTENT: Record<Sentiment, string> = {
  sarcastic: "praise_that_signals_doubt",
  deflecting: "delay_disguised_as_agreement",
  aggressive: "pressure_to_force_concession",
  appeasement: "softening_to_keep_the_deal",
  negative: "unspoken_objection",
  positive: "genuine_alignment",
  neutral: "insufficient_commitment",
};

function hostile(sentiment: Sentiment | null): boolean {
  if (!sentiment) return false;
  return sentimentFamily(sentiment) === "hostile";
}

export function heuristic(context: ClassifyContext): Draft {
  const features = context.features;
  const spiked = features.pitchBin === "high" || features.rateBin === "very_fast";
  const stall = (features.concession || features.hedge) && features.delay;
  let sentiment: Sentiment = "neutral";
  let hiddenIntent = INTENT.neutral;
  let mitigation = MITIGATION.neutral;

  if (stall && spiked) {
    sentiment = "sarcastic";
    hiddenIntent = "deflection_via_polite_stall";
    mitigation = "Acknowledge the stall and propose a joint review with a fixed date.";
  } else if (stall) {
    sentiment = "deflecting";
    hiddenIntent = INTENT.deflecting;
    mitigation = MITIGATION.deflecting;
  } else if (spiked && features.negativeHits > 0 && features.pitch >= 0.6) {
    sentiment = "aggressive";
    hiddenIntent = INTENT.aggressive;
    mitigation = MITIGATION.aggressive;
  } else if (
    features.positiveHits > 0 &&
    features.intensifier &&
    spiked &&
    features.negativeHits === 0
  ) {
    sentiment = "sarcastic";
    hiddenIntent = INTENT.sarcastic;
    mitigation = MITIGATION.sarcastic;
  } else if (
    hostile(context.previousSentiment) &&
    features.softener &&
    features.negativeHits === 0 &&
    features.volumeBin !== "high"
  ) {
    sentiment = "appeasement";
    hiddenIntent = INTENT.appeasement;
    mitigation = MITIGATION.appeasement;
  } else if (features.negativeHits > features.positiveHits) {
    sentiment = "negative";
    hiddenIntent = INTENT.negative;
    mitigation = MITIGATION.negative;
  } else if (features.positiveHits > features.negativeHits && features.pitchBin !== "high") {
    sentiment = "positive";
    hiddenIntent = INTENT.positive;
    mitigation = MITIGATION.positive;
  }

  const cueCount = [features.concession, features.hedge, features.delay, features.intensifier, features.softener].filter(Boolean).length;
  const confidence = clamp(0.58 + cueCount * 0.06 + (features.pitchBin === "high" ? 0.08 : 0), 0.55, 0.9);

  return {
    sentiment,
    confidence,
    modelVolatility: false,
    hiddenIntent,
    mitigation,
    modelRisk: ruleRisk(sentiment, false),
    source: "fallback",
  };
}
