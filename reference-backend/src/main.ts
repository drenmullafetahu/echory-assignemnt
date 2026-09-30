import path from "path";
import http from "http";
import dotenv from "dotenv";
import type { ChunkRequest, ClassifyFn } from "./types";
import { activeModel, loadConfig } from "./config";
import { providerChoices } from "./catalog";
import { extractFeatures } from "./features";
import { buildClassifier } from "./llm/classify";
import { createApp } from "./server";
import type { ProviderName } from "./types";

const backendRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(backendRoot, "..");
dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config({ path: path.join(backendRoot, ".env") });

const config = loadConfig();
const classify = buildClassifier(config);
const model = activeModel(config);
const { app, attachWebSocket } = createApp({
  classify,
  provider: config.provider,
  model,
  timeoutMs: config.timeoutMs,
  cacheMax: config.cacheMax,
  choices: () => providerChoices(config),
  apply: (provider: ProviderName, nextModel: string | null) => {
    config.provider = provider;
    if (provider === "groq" && nextModel) config.groqModel = nextModel;
    if (provider === "gemini" && nextModel) config.geminiModel = nextModel;
    if (provider === "openai" && nextModel) config.openaiModel = nextModel;
    if (provider === "ollama" && nextModel) config.ollamaModel = nextModel;
    return buildClassifier(config);
  },
});

const server = http.createServer(app);
attachWebSocket(server);

server.listen(config.port, () => {
  console.log(`Sentiment engine listening on http://localhost:${config.port}`);
  console.log(`Provider: ${config.provider}${model ? ` (${model})` : ""}`);
  console.log(`Timeout: ${config.timeoutMs} ms. Cache: ${config.cacheMax > 0 ? config.cacheMax : "off"}`);
  console.log(`WebSocket: ws://localhost:${config.port}/ws/telemetry`);
  if (config.provider === "fallback") {
    console.log("No free-tier key is configured. Classifications use the local heuristic.");
  }
  if (classify) void warmup(classify);
});

async function warmup(classifyFn: ClassifyFn): Promise<void> {
  const chunk: ChunkRequest = {
    chunk_id: "warmup",
    session_id: "warmup",
    timestamp_ms: Date.now(),
    speaker: "counterpart",
    text: "Hello.",
    acoustic_metadata: {
      pitch_volatility: 0.2,
      speech_rate_wpm: 120,
      pause_duration_ms: 200,
      volume_intensity: 0.3,
    },
  };
  try {
    await classifyFn(
      { chunk, features: extractFeatures(chunk), previousSentiment: null },
      AbortSignal.timeout(config.timeoutMs),
    );
  } catch {
    // The first live chunk retries. Warmup only opens the provider connection.
  }
}
