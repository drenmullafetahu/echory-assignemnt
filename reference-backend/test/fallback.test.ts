import assert from "node:assert/strict";
import { test } from "node:test";
import { extractFeatures } from "../src/features";
import { heuristic } from "../src/fallback";
import { normalizeModelOutput } from "../src/llm/normalize";
import { resolveProvider } from "../src/config";
import { toIntent, truncate } from "../src/text";
import { sampleChunk } from "./helpers";

test("polite stall with a fast, variable voice is sarcastic deflection", () => {
  const chunk = sampleChunk();
  const result = heuristic({
    chunk,
    features: extractFeatures(chunk),
    previousSentiment: null,
  });

  assert.equal(result.sentiment, "sarcastic");
  assert.equal(result.hiddenIntent, "deflection_via_polite_stall");
  assert.ok(result.mitigation.length <= 120);
  assert.ok(result.hiddenIntent.length <= 60);
});

test("the same stall spoken calmly is deflection, not sarcasm", () => {
  const chunk = sampleChunk({
    acoustic_metadata: {
      pitch_volatility: 0.22,
      speech_rate_wpm: 128,
      pause_duration_ms: 640,
      volume_intensity: 0.34,
    },
  });
  const result = heuristic({
    chunk,
    features: extractFeatures(chunk),
    previousSentiment: null,
  });
  assert.equal(result.sentiment, "deflecting");
});

test("praise at high pitch and speed is sarcasm", () => {
  const chunk = sampleChunk({
    text: "Oh, absolutely. Your timeline is wonderfully ambitious.",
    acoustic_metadata: {
      pitch_volatility: 0.84,
      speech_rate_wpm: 198,
      pause_duration_ms: 160,
      volume_intensity: 0.66,
    },
  });
  const result = heuristic({
    chunk,
    features: extractFeatures(chunk),
    previousSentiment: "positive",
  });
  assert.equal(result.sentiment, "sarcastic");
});

test("a loud fast rejection is aggression", () => {
  const chunk = sampleChunk({
    text: "This number is unacceptable. We are not going to be pushed around on price.",
    acoustic_metadata: {
      pitch_volatility: 0.88,
      speech_rate_wpm: 206,
      pause_duration_ms: 90,
      volume_intensity: 0.86,
    },
  });
  const result = heuristic({
    chunk,
    features: extractFeatures(chunk),
    previousSentiment: "neutral",
  });
  assert.equal(result.sentiment, "aggressive");
});

test("softening after hostility is appeasement", () => {
  const chunk = sampleChunk({
    text: "Sorry. We do want this to work, and we are happy to be flexible on the timeline.",
    acoustic_metadata: {
      pitch_volatility: 0.3,
      speech_rate_wpm: 122,
      pause_duration_ms: 640,
      volume_intensity: 0.34,
    },
  });
  const result = heuristic({
    chunk,
    features: extractFeatures(chunk),
    previousSentiment: "aggressive",
  });
  assert.equal(result.sentiment, "appeasement");
});

test("short model keys map back to the public fields", () => {
  const draft = normalizeModelOutput({
    s: "appeasement",
    c: 0.91,
    v: false,
    i: "soften_after_hostility",
    m: "Name the timeline you can accept.",
    r: "medium",
  });
  assert.equal(draft.sentiment, "appeasement");
  assert.equal(draft.confidence, 0.91);
  assert.equal(draft.modelVolatility, false);
  assert.equal(draft.hiddenIntent, "soften_after_hostility");
  assert.equal(draft.mitigation, "Name the timeline you can accept.");
  assert.equal(draft.modelRisk, "medium");
});

test("model output is clamped to the contract", () => {
  const draft = normalizeModelOutput({
    sentiment: "deflection",
    confidence: 1.4,
    volatility_flag: "false",
    hidden_intent: "Delay via the legal team and then some extra words that should not survive the limit",
    mitigation_suggestion: "x".repeat(200),
    risk_level: "severe",
  });
  assert.equal(draft.sentiment, "deflecting");
  assert.equal(draft.confidence, 1);
  assert.equal(draft.modelVolatility, false);
  assert.equal(draft.modelRisk, "critical");
  assert.ok(draft.hiddenIntent.length <= 60);
  assert.ok(draft.mitigation.length <= 120);
  assert.equal(truncate("hello", 120), "hello");
  assert.equal(toIntent("Hello World"), "hello_world");
});

test("provider selection prefers an explicit configured key and does not hang without one", () => {
  assert.equal(resolveProvider({ LLM_PROVIDER: "groq" }), "fallback");
  assert.equal(resolveProvider({ LLM_PROVIDER: "groq", GROQ_API_KEY: "gsk_test" }), "groq");
  assert.equal(resolveProvider({ LLM_PROVIDER: "openai" }), "fallback");
  assert.equal(resolveProvider({ LLM_PROVIDER: "openai", OPENAI_API_KEY: "sk-test" }), "openai");
  assert.equal(resolveProvider({ OPENAI_API_KEY: "sk-test", GROQ_API_KEY: "gsk_test" }), "groq");
  assert.equal(resolveProvider({ GEMINI_API_KEY: "gem" }), "gemini");
  assert.equal(resolveProvider({ LLM_PROVIDER: "ollama" }), "ollama");
  assert.equal(resolveProvider({}), "ollama");
});
