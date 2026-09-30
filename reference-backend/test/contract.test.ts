import { createServer, type Server } from "http";
import type { AddressInfo } from "net";
import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import WebSocket from "ws";
import { createApp } from "../src/server";
import type { AnalysisResponse } from "../src/types";
import { classifying, sampleChunk } from "./helpers";

const SENTIMENTS = new Set([
  "positive",
  "negative",
  "neutral",
  "sarcastic",
  "aggressive",
  "deflecting",
  "appeasement",
]);
const RISKS = new Set(["low", "medium", "high", "critical"]);

function model(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sentiment: "neutral",
    confidence: 0.7,
    volatility_flag: false,
    hidden_intent: "insufficient_commitment",
    mitigation_suggestion: "Ask one open question that asks for a specific commitment.",
    risk_level: "low",
    ...overrides,
  };
}

function assertContract(body: AnalysisResponse, chunkId: string): void {
  assert.equal(body.chunk_id, chunkId);
  assert.equal(typeof body.processing_latency_ms, "number");
  assert.ok(body.processing_latency_ms >= 0);
  assert.ok(body.processing_latency_ms < 500);
  assert.ok(SENTIMENTS.has(body.sentiment));
  assert.ok(body.confidence >= 0 && body.confidence <= 1);
  assert.equal(typeof body.volatility_flag, "boolean");
  assert.ok(body.hidden_intent.length <= 60);
  assert.ok(body.mitigation_suggestion.length <= 120);
  assert.ok(RISKS.has(body.risk_level));
}

test("POST /api/telemetry/stream returns the contract", async () => {
  const classifier = classifying(async () =>
    model({
      sentiment: "sarcastic",
      confidence: 0.84,
      hidden_intent: "deflection_via_polite_stall",
      mitigation_suggestion: "Acknowledge the stall and propose a joint review with a fixed date.",
      risk_level: "high",
    }),
  );
  const { app } = createApp({ classify: classifier.fn, provider: "groq", timeoutMs: 420 });
  const chunk = sampleChunk();
  const response = await request(app).post("/api/telemetry/stream").send(chunk);

  assert.equal(response.status, 200);
  const body = response.body as AnalysisResponse;
  assertContract(body, chunk.chunk_id);
  assert.equal(body.sentiment, "sarcastic");
  assert.equal(body.hidden_intent, "deflection_via_polite_stall");
  assert.equal(body.volatility_flag, true);
  assert.equal(body.risk_level, "high");
  assert.equal(body.source, "groq");
});

test("invalid chunks are rejected", async () => {
  const { app } = createApp({ classify: null, provider: "fallback" });
  const response = await request(app).post("/api/telemetry/stream").send({ text: "hello" });
  assert.equal(response.status, 400);
});

test("a provider failure falls back inside the latency rail", async () => {
  const classifier = classifying(async (_context, signal) => {
    await new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
    return model();
  });
  const { app } = createApp({ classify: classifier.fn, provider: "groq", timeoutMs: 40 });
  const started = performance.now();
  const response = await request(app).post("/api/telemetry/stream").send(sampleChunk());
  const elapsed = performance.now() - started;

  assert.equal(response.status, 200);
  const body = response.body as AnalysisResponse;
  assert.equal(body.sentiment, "sarcastic");
  assert.equal(body.source, "heuristic");
  assert.ok(elapsed < 500);
  assert.ok(body.processing_latency_ms < 500);
});

test("sessions do not bleed", async () => {
  const classifier = classifying(async (context) => {
    if (context.chunk.text.includes("unacceptable")) {
      return model({ sentiment: "aggressive", risk_level: "high", hidden_intent: "pressure_to_force_concession" });
    }
    return model({ sentiment: "positive", risk_level: "low", hidden_intent: "genuine_alignment" });
  });
  const { app } = createApp({ classify: classifier.fn, provider: "groq" });

  await request(app).post("/api/telemetry/stream").send(sampleChunk({
    chunk_id: "a1",
    session_id: "session_a",
    text: "We are glad to move ahead on the partnership.",
    acoustic_metadata: { pitch_volatility: 0.2, speech_rate_wpm: 120, pause_duration_ms: 300, volume_intensity: 0.3 },
  }));
  await request(app).post("/api/telemetry/stream").send(sampleChunk({
    chunk_id: "b1",
    session_id: "session_b",
    text: "This number is unacceptable.",
    acoustic_metadata: { pitch_volatility: 0.2, speech_rate_wpm: 120, pause_duration_ms: 300, volume_intensity: 0.3 },
  }));

  const summaryA = await request(app).get("/api/telemetry/session/session_a/summary");
  const summaryB = await request(app).get("/api/telemetry/session/session_b/summary");
  const missing = await request(app).get("/api/telemetry/session/missing/summary");

  assert.equal(summaryA.status, 200);
  assert.equal(summaryA.body.dominant_sentiment, "positive");
  assert.equal(summaryA.body.chunk_count, 1);
  assert.equal(summaryA.body.top_risk_moments.length, 0);
  assert.equal(summaryB.body.dominant_sentiment, "aggressive");
  assert.equal(summaryB.body.top_risk_moments[0].chunk_id, "b1");
  assert.equal(missing.status, 404);
});

test("identical first turns share a cached classification", async () => {
  const classifier = classifying(async () => model({ sentiment: "neutral" }));
  const { app } = createApp({ classify: classifier.fn, provider: "groq" });
  const first = sampleChunk({ chunk_id: "c1", session_id: "cache_a", text: "Let's review the agenda." });
  const second = sampleChunk({ chunk_id: "c2", session_id: "cache_b", text: "Let's review the agenda." });

  const firstResponse = await request(app).post("/api/telemetry/stream").send(first);
  const secondResponse = await request(app).post("/api/telemetry/stream").send(second);
  assert.equal(classifier.calls(), 1);
  assert.equal(firstResponse.body.source, "groq");
  assert.equal(secondResponse.body.source, "cached");
});

test("a later turn does not reuse a cache entry from a different previous sentiment", async () => {
  const classifier = classifying(async () => model({ sentiment: "neutral" }));
  const { app } = createApp({ classify: classifier.fn, provider: "groq" });
  const text = "Let's review the agenda.";
  await request(app).post("/api/telemetry/stream").send(sampleChunk({
    chunk_id: "h1",
    session_id: "history",
    text,
    timestamp_ms: 1_700_000_000_000,
  }));
  await request(app).post("/api/telemetry/stream").send(sampleChunk({
    chunk_id: "h2",
    session_id: "history",
    text,
    timestamp_ms: 1_700_000_005_000,
  }));
  assert.equal(classifier.calls(), 2);
});

test("a disabled classification cache calls the provider every time", async () => {
  const classifier = classifying(async () => model({ sentiment: "neutral" }));
  const { app } = createApp({ classify: classifier.fn, provider: "groq", cacheMax: 0 });
  const text = "Let's review the agenda.";
  await request(app).post("/api/telemetry/stream").send(sampleChunk({ chunk_id: "d1", session_id: "off_a", text }));
  const second = await request(app).post("/api/telemetry/stream").send(sampleChunk({ chunk_id: "d2", session_id: "off_b", text }));
  assert.equal(classifier.calls(), 2);
  assert.equal(second.body.source, "groq");
});

test("overlapping copies of one chunk share a single classification", async () => {
  const classifier = classifying(async () => {
    await new Promise((resolve) => setTimeout(resolve, 40));
    return model({ sentiment: "neutral" });
  });
  const { app } = createApp({ classify: classifier.fn, provider: "groq" });
  const chunk = sampleChunk({ chunk_id: "same", session_id: "flight" });
  const [left, right] = await Promise.all([
    request(app).post("/api/telemetry/stream").send(chunk),
    request(app).post("/api/telemetry/stream").send(chunk),
  ]);

  assert.equal(left.status, 200);
  assert.equal(right.status, 200);
  assert.equal(classifier.calls(), 1);
  const summary = await request(app).get("/api/telemetry/session/flight/summary");
  assert.equal(summary.body.chunk_count, 1);
});

test("websocket uses the same request and response schema", async () => {
  const { app, attachWebSocket } = createApp({
    classify: classifying(async () => model({
      sentiment: "deflecting",
      hidden_intent: "delay_disguised_as_agreement",
      risk_level: "medium",
    })).fn,
    provider: "groq",
  });
  const server: Server = createServer(app);
  attachWebSocket(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  const socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws/telemetry`);

  try {
    await new Promise<void>((resolve, reject) => {
      socket.once("open", () => resolve());
      socket.once("error", reject);
    });
    const chunk = sampleChunk({
      chunk_id: "ws_1",
      acoustic_metadata: { pitch_volatility: 0.2, speech_rate_wpm: 120, pause_duration_ms: 400, volume_intensity: 0.3 },
    });
    const body = await new Promise<AnalysisResponse>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("websocket timed out")), 2000);
      socket.once("message", (data) => {
        clearTimeout(timer);
        resolve(JSON.parse(data.toString()) as AnalysisResponse);
      });
      socket.send(JSON.stringify(chunk));
    });
    assertContract(body, "ws_1");
    assert.equal(body.sentiment, "deflecting");
    assert.equal(body.hidden_intent, "delay_disguised_as_agreement");
  } finally {
    socket.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("the dashboard can switch the live provider", async () => {
  const classifier = classifying(async () => model({ sentiment: "positive", hidden_intent: "express_interest" }));
  let applied = "groq";
  const { app } = createApp({
    classify: classifier.fn,
    provider: "groq",
    model: "openai/gpt-oss-20b",
    choices: async () => [
      { id: "groq", label: "Groq", available: true, models: ["openai/gpt-oss-20b", "qwen/qwen3.8-27b"] },
      { id: "fallback", label: "Heuristic", available: true, models: [] },
    ],
    apply: (provider) => {
      applied = provider;
      return provider === "fallback" ? null : classifier.fn;
    },
  });

  const listed = await request(app).get("/api/engine");
  assert.equal(listed.status, 200);
  assert.equal(listed.body.provider, "groq");
  assert.equal(listed.body.model, "openai/gpt-oss-20b");

  const rejected = await request(app).post("/api/engine").send({ provider: "groq", model: "missing" });
  assert.equal(rejected.status, 400);

  const switched = await request(app).post("/api/engine").send({ provider: "fallback", model: null });
  assert.equal(switched.status, 200);
  assert.equal(switched.body.provider, "fallback");
  assert.equal(switched.body.model, null);
  assert.equal(applied, "fallback");

  const response = await request(app).post("/api/telemetry/stream").send(sampleChunk());
  assert.equal(response.body.source, "heuristic");
  const health = await request(app).get("/health");
  assert.equal(health.body.mode, "fallback");
  assert.equal(health.body.model, null);
});
