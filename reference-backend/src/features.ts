import type { ChunkRequest, Features, PauseBin, PitchBin, RateBin, Sentiment, VolumeBin } from "./types";
import { clamp, countWords, hasPhrase } from "./text";

const POSITIVE = [
  "great",
  "good",
  "glad",
  "happy",
  "agree",
  "love",
  "excited",
  "thank",
  "committed",
  "absolutely",
  "wonderful",
  "wonderfully",
  "excellent",
  "fantastic",
  "perfect",
  "pleased",
  "aligned",
  "partnership",
  "ready",
] as const;

const NEGATIVE = [
  "unacceptable",
  "never",
  "refuse",
  "impossible",
  "ridiculous",
  "insulting",
  "disappointed",
  "problem",
  "wrong",
  "hate",
  "pushed",
  "demand",
] as const;

const CONCESSION = ["though", "however", "although", "nevertheless", "nonetheless", "yet", "but"] as const;
const HEDGES = ["naturally", "of course", "perhaps", "maybe", "sort of", "a bit"] as const;
const DELAYS = [
  "legal",
  "review",
  "later",
  "circle back",
  "next week",
  "approval",
  "procurement",
  "check with",
  "sign off",
  "internally",
  "take this back",
  "loop in",
] as const;
const INTENSIFIERS = [
  "absolutely",
  "every single",
  "never",
  "always",
  "completely",
  "totally",
  "wonderfully",
  "incredibly",
  "extremely",
] as const;
const SOFTENERS = [
  "sorry",
  "understand",
  "happy to",
  "we can",
  "fair enough",
  "appreciate",
  "flexible",
  "compromise",
  "find some room",
  "of course",
] as const;

export function pitchBin(pitch: number): PitchBin {
  if (pitch >= 0.7) return "high";
  if (pitch >= 0.4) return "mid";
  return "low";
}

export function rateBin(wpm: number): RateBin {
  if (wpm >= 180) return "very_fast";
  if (wpm >= 150) return "fast";
  if (wpm >= 110) return "moderate";
  return "slow";
}

export function pauseBin(pauseMs: number): PauseBin {
  if (pauseMs >= 900) return "long";
  if (pauseMs >= 250) return "medium";
  return "short";
}

export function volumeBin(volume: number): VolumeBin {
  if (volume >= 0.75) return "high";
  if (volume >= 0.4) return "mid";
  return "low";
}

export function extractFeatures(chunk: ChunkRequest): Features {
  const text = chunk.text;
  const pitch = chunk.acoustic_metadata.pitch_volatility;
  const wpm = chunk.acoustic_metadata.speech_rate_wpm;
  const pauseMs = chunk.acoustic_metadata.pause_duration_ms;
  const volume = chunk.acoustic_metadata.volume_intensity;
  const rateSignal = clamp(wpm / 220, 0, 1);
  const pauseSignal = pauseMs < 150 ? 0.35 : pauseMs > 1200 ? 0.2 : 0.05;
  const arousal = clamp(0.45 * pitch + 0.25 * rateSignal + 0.2 * volume + pauseSignal, 0, 1);

  return {
    pitch,
    wpm,
    pauseMs,
    volume,
    pitchBin: pitchBin(pitch),
    rateBin: rateBin(wpm),
    pauseBin: pauseBin(pauseMs),
    volumeBin: volumeBin(volume),
    arousal,
    concession: countWords(text, CONCESSION) > 0,
    hedge: hasPhrase(text, HEDGES),
    delay: hasPhrase(text, DELAYS),
    intensifier: hasPhrase(text, INTENSIFIERS),
    softener: hasPhrase(text, SOFTENERS),
    positiveHits: countWords(text, POSITIVE),
    negativeHits: countWords(text, NEGATIVE),
  };
}

export function cacheKey(text: string, features: Features, previousSentiment: Sentiment | null): string {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  return [
    normalized,
    features.pitchBin,
    features.rateBin,
    features.pauseBin,
    features.volumeBin,
    previousSentiment ?? "none",
  ].join("|");
}
