import { useCallback, useEffect, useRef, useState } from "react";
import { DEMO_SCRIPT } from "../demo/script";
import { parseAnalysis, type AcousticMetadata, type AnalysisResponse, type ChunkRequest, type Speaker, type StreamItem } from "../types";

const TURN_GAP_MS = 420;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function useTelemetry() {
  const [items, setItems] = useState<StreamItem[]>([]);
  const [connected, setConnected] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState("waiting");
  const socketRef = useRef<WebSocket | null>(null);
  const sentRef = useRef<Map<string, ChunkRequest>>(new Map());
  const waitersRef = useRef<Map<string, () => void>>(new Map());
  const httpRttRef = useRef<Map<string, number>>(new Map());
  const focusSessionRef = useRef<string | null>(null);
  const customSessionRef = useRef<string | null>(null);
  const submittingRef = useRef(false);
  const simulatingRef = useRef(false);

  const apply = useCallback((analysis: AnalysisResponse) => {
    if (focusSessionRef.current && analysis.session_id && analysis.session_id !== focusSessionRef.current) {
      return;
    }
    const sent = sentRef.current.get(analysis.chunk_id) ?? null;
    const httpRttMs = httpRttRef.current.get(analysis.chunk_id) ?? null;
    setItems((current) => {
      const index = current.findIndex((item) => item.analysis.chunk_id === analysis.chunk_id);
      if (index === -1) return [...current, { analysis, chunk: sent, httpRttMs }];
      return current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        return { analysis, chunk: item.chunk ?? sent, httpRttMs: httpRttMs ?? item.httpRttMs };
      });
    });
    const waiter = waitersRef.current.get(analysis.chunk_id);
    if (waiter) {
      waitersRef.current.delete(analysis.chunk_id);
      waiter();
    }
  }, []);

  useEffect(() => {
    let stopped = false;
    let retry = 0;

    const connect = (): void => {
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const socket = new WebSocket(`${protocol}://${window.location.host}/ws/telemetry`);
      socketRef.current = socket;
      socket.onopen = () => {
        setConnected(true);
        setError(null);
      };
      socket.onclose = () => {
        setConnected(false);
        if (!stopped) retry = window.setTimeout(connect, 1000);
      };
      socket.onmessage = (event) => {
        const analysis = parseAnalysis(String(event.data));
        if (analysis) apply(analysis);
      };
    };

    connect();
    return () => {
      stopped = true;
      window.clearTimeout(retry);
      socketRef.current?.close();
    };
  }, [apply]);

  const simulate = useCallback(async () => {
    if (submittingRef.current || simulatingRef.current) return;
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setError("The live socket is not connected. Start the backend on port 3000.");
      return;
    }
    const nextSession = `session_demo_${Date.now()}`;
    focusSessionRef.current = nextSession;
    sentRef.current.clear();
    waitersRef.current.clear();
    httpRttRef.current.clear();
    setSessionId(nextSession);
    setItems([]);
    setError(null);
    simulatingRef.current = true;
    setSimulating(true);
    try {
      for (let index = 0; index < DEMO_SCRIPT.length; index += 1) {
        const template = DEMO_SCRIPT[index];
        if (!template) continue;
        const chunk: ChunkRequest = {
          ...template,
          session_id: nextSession,
          chunk_id: `${nextSession}_${template.chunk_id}`,
          timestamp_ms: Date.now(),
        };
        sentRef.current.set(chunk.chunk_id, chunk);
        const done = new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(() => reject(new Error("A chunk did not return in time.")), 8000);
          waitersRef.current.set(chunk.chunk_id, () => {
            window.clearTimeout(timer);
            resolve();
          });
        });
        socket.send(JSON.stringify(chunk));
        await done;
        if (index < DEMO_SCRIPT.length - 1) await delay(TURN_GAP_MS);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Simulation failed");
    } finally {
      simulatingRef.current = false;
      setSimulating(false);
    }
  }, []);

  const newSession = useCallback(() => {
    if (simulatingRef.current) return;
    const nextSession = `session_custom_${Date.now()}`;
    customSessionRef.current = nextSession;
    focusSessionRef.current = nextSession;
    sentRef.current.clear();
    waitersRef.current.clear();
    httpRttRef.current.clear();
    setSessionId(nextSession);
    setItems([]);
    setError(null);
  }, []);

  const submitCustom = useCallback(async (input: { speaker: Speaker; text: string; acoustic: AcousticMetadata }) => {
    if (simulatingRef.current || submittingRef.current) {
      throw new Error("Wait for the current analysis to finish.");
    }
    const session = customSessionRef.current ?? `session_custom_${Date.now()}`;
    customSessionRef.current = session;
    focusSessionRef.current = session;
    setSessionId(session);
    const chunk: ChunkRequest = {
      chunk_id: `${session}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      session_id: session,
      timestamp_ms: Date.now(),
      speaker: input.speaker,
      text: input.text,
      acoustic_metadata: input.acoustic,
    };
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    sentRef.current.set(chunk.chunk_id, chunk);
    const started = performance.now();
    try {
      const response = await fetch("/api/telemetry/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(chunk),
      });
      const httpRttMs = Math.max(0, Math.round(performance.now() - started));
      const body = await response.json() as unknown;
      if (!response.ok) {
        const message = body && typeof body === "object" && "error" in body && typeof body.error === "string"
          ? body.error
          : "The analysis request failed.";
        throw new Error(message);
      }
      const analysis = parseAnalysis(JSON.stringify(body));
      if (!analysis) throw new Error("The analysis response did not match the contract.");
      if (focusSessionRef.current !== chunk.session_id) return;
      httpRttRef.current.set(chunk.chunk_id, httpRttMs);
      apply(analysis);
    } catch (caught) {
      if (caught instanceof SyntaxError) throw new Error("The analysis response was not valid JSON.");
      if (caught instanceof Error && caught.message === "Failed to fetch") throw new Error("Could not reach the engine.");
      throw caught instanceof Error ? caught : new Error("The analysis request failed.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [apply]);

  const latest = items.length > 0 ? items[items.length - 1] ?? null : null;

  return { items, latest, connected, simulating, submitting, error, sessionId, simulate, newSession, submitCustom };
}
