import cors from "cors";
import express, { type ErrorRequestHandler, type Express } from "express";
import type { Server as HttpServer } from "http";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import { z } from "zod";
import type { ClassifyFn, ProviderName } from "./types";
import type { ProviderChoice } from "./catalog";
import { LruCache } from "./cache";
import { AnalysisEngine } from "./engine";
import { SessionStore } from "./session-store";
import { SPEAKERS } from "./types";

const chunkSchema = z.object({
  chunk_id: z.string().min(1),
  session_id: z.string().min(1),
  timestamp_ms: z.number().finite(),
  speaker: z.enum(SPEAKERS),
  text: z.string(),
  acoustic_metadata: z.object({
    pitch_volatility: z.number().finite(),
    speech_rate_wpm: z.number().finite(),
    pause_duration_ms: z.number().finite(),
    volume_intensity: z.number().finite(),
  }),
});

export interface AppHandle {
  app: Express;
  engine: AnalysisEngine;
  provider: ProviderName;
  attachWebSocket: (server: HttpServer) => WebSocketServer;
}

export interface CreateAppOptions {
  classify: ClassifyFn | null;
  provider: ProviderName;
  model?: string | null;
  timeoutMs?: number;
  cacheMax?: number;
  choices?: () => Promise<ProviderChoice[]>;
  apply?: (provider: ProviderName, model: string | null) => ClassifyFn | null;
}

export function createApp(options: CreateAppOptions): AppHandle {
  const sessions = new SessionStore();
  const cacheMax = options.cacheMax ?? 500;
  const timeoutMs = options.timeoutMs ?? 420;
  const engine = new AnalysisEngine(
    sessions,
    new LruCache(cacheMax),
    options.classify,
    timeoutMs,
    options.provider,
    cacheMax > 0,
  );
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "100kb" }));

  let sockets: WebSocketServer | null = null;

  const broadcast = (payload: string, except?: WebSocket): void => {
    if (!sockets) return;
    for (const client of sockets.clients) {
      if (client !== except && client.readyState === WebSocket.OPEN) client.send(payload);
    }
  };

  const live = {
    provider: options.provider,
    model: options.model ?? null,
  };

  const selectionSchema = z.object({
    provider: z.enum(["groq", "gemini", "openai", "ollama", "fallback"]),
    model: z.string().nullable().optional(),
  });

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      mode: live.provider,
      model: live.model,
      track: "A",
      version: "1.1.0",
      timeout_ms: timeoutMs,
      cache_max: cacheMax,
      timestamp: Date.now(),
    });
  });

  app.get("/api/engine", async (_req, res) => {
    const choices = options.choices ? await options.choices() : [];
    res.json({ provider: live.provider, model: live.model, options: choices });
  });

  app.post("/api/engine", async (req, res) => {
    if (!options.apply || !options.choices) {
      res.status(400).json({ error: "Provider switching is not enabled." });
      return;
    }
    const parsed = selectionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid provider selection." });
      return;
    }
    const choices = await options.choices();
    const choice = choices.find((item) => item.id === parsed.data.provider);
    const model = parsed.data.model ?? null;
    if (!choice?.available) {
      res.status(400).json({ error: "That provider is not available." });
      return;
    }
    if (choice.models.length === 0 ? model !== null : !model || !choice.models.includes(model)) {
      res.status(400).json({ error: "That model is not available for this provider." });
      return;
    }
    engine.retarget(choice.id, options.apply(choice.id, model));
    live.provider = choice.id;
    live.model = model;
    res.json({ provider: live.provider, model: live.model, options: choices });
  });

  app.post("/api/telemetry/stream", (req, res, next) => {
    const startedAt = performance.now();
    const parsed = chunkSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid chunk", details: parsed.error.flatten() });
      return;
    }
    void engine
      .analyzeAndRecord(parsed.data, startedAt)
      .then((result) => {
        res.json(result);
        broadcast(JSON.stringify(result));
      })
      .catch(next);
  });

  app.get("/api/telemetry/session/:sessionId/summary", (req, res) => {
    const summary = sessions.summary(req.params.sessionId);
    if (!summary) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json(summary);
  });

  const onError: ErrorRequestHandler = (error, _req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    res.status(500).json({ error: "Analysis failed" });
  };
  app.use(onError);

  const handleSocketMessage = async (socket: WebSocket, data: RawData): Promise<void> => {
    const startedAt = performance.now();
    let body: unknown;
    try {
      body = JSON.parse(data.toString()) as unknown;
    } catch {
      return;
    }
    const parsed = chunkSchema.safeParse(body);
    if (!parsed.success) return;
    const result = await engine.analyzeAndRecord(parsed.data, startedAt);
    const payload = JSON.stringify(result);
    if (socket.readyState === WebSocket.OPEN) socket.send(payload);
    broadcast(payload, socket);
  };

  return {
    app,
    engine,
    provider: options.provider,
    attachWebSocket(server: HttpServer): WebSocketServer {
      sockets = new WebSocketServer({ server, path: "/ws/telemetry" });
      sockets.on("connection", (socket) => {
        socket.on("message", (data) => {
          void handleSocketMessage(socket, data).catch((error: unknown) => {
            const reason = error instanceof Error ? error.message : "unknown error";
            console.warn(`WebSocket chunk failed (${reason})`);
          });
        });
      });
      return sockets;
    },
  };
}
