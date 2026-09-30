import assert from "node:assert/strict";
import { test } from "node:test";
import { sayNext, TRIGGERED_BY_CANDIDATE, TRIGGERED_BY_COUNTERPART, WAITING_FOR_COUNTERPART } from "../src/say-next";
import type { AnalysisResponse, ChunkRequest, StreamItem } from "../src/types";

function turn(speaker: "candidate" | "counterpart", mitigation: string, intent: string): StreamItem {
  const chunk: ChunkRequest = {
    chunk_id: `${speaker}_${mitigation}`,
    session_id: "session_custom",
    timestamp_ms: 1,
    speaker,
    text: speaker === "candidate" ? "We can move ahead." : "Our legal team will review this.",
    acoustic_metadata: {
      pitch_volatility: 0.24,
      speech_rate_wpm: 130,
      pause_duration_ms: 400,
      volume_intensity: 0.4,
    },
  };
  const analysis: AnalysisResponse = {
    chunk_id: chunk.chunk_id,
    session_id: chunk.session_id,
    processing_latency_ms: 10,
    sentiment: speaker === "candidate" ? "positive" : "deflecting",
    confidence: 0.8,
    volatility_flag: false,
    hidden_intent: intent,
    mitigation_suggestion: mitigation,
    risk_level: "low",
    source: "groq",
  };
  return { analysis, chunk, httpRttMs: 12 };
}

test("a custom counterpart turn becomes the line the candidate can say next", () => {
  const advice = sayNext([turn("counterpart", "Ask for a review date.", "stall_via_legal_review")]);
  assert.equal(advice.suggestion, "Ask for a review date.");
  assert.equal(advice.intent, "stall_via_legal_review");
  assert.equal(advice.triggeredBy, TRIGGERED_BY_COUNTERPART);
});

test("a custom candidate turn keeps the prior recommendation", () => {
  const advice = sayNext([
    turn("counterpart", "Ask for a review date.", "stall_via_legal_review"),
    turn("candidate", "Reply to yourself.", "state_next_step"),
  ]);
  assert.equal(advice.suggestion, "Ask for a review date.");
  assert.equal(advice.intent, "stall_via_legal_review");
  assert.equal(advice.triggeredBy, TRIGGERED_BY_COUNTERPART);
  assert.notEqual(advice.triggeredBy, TRIGGERED_BY_CANDIDATE);
});

test("a custom candidate turn with no prior counterpart advice waits", () => {
  const advice = sayNext([turn("candidate", "Reply to yourself.", "state_next_step")]);
  assert.equal(advice.suggestion, WAITING_FOR_COUNTERPART);
  assert.equal(advice.intent, null);
  assert.equal(advice.triggeredBy, TRIGGERED_BY_CANDIDATE);
});

test("a later counterpart turn replaces the waiting status", () => {
  const advice = sayNext([
    turn("candidate", "Reply to yourself.", "state_next_step"),
    turn("counterpart", "Ask for a review date.", "stall_via_legal_review"),
  ]);
  assert.equal(advice.suggestion, "Ask for a review date.");
  assert.equal(advice.triggeredBy, TRIGGERED_BY_COUNTERPART);
});
