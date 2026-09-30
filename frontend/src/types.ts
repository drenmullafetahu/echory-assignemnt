export type Sentiment =
  | "positive"
  | "negative"
  | "neutral"
  | "sarcastic"
  | "aggressive"
  | "deflecting"
  | "appeasement";

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type Speaker = "candidate" | "counterpart";
export type ClassificationSource = "groq" | "gemini" | "openai" | "ollama" | "cached" | "heuristic";

export interface AcousticMetadata {
  pitch_volatility: number;
  speech_rate_wpm: number;
  pause_duration_ms: number;
  volume_intensity: number;
}

export interface ChunkRequest {
  chunk_id: string;
  session_id: string;
  timestamp_ms: number;
  speaker: Speaker;
  text: string;
  acoustic_metadata: AcousticMetadata;
}

export interface AnalysisResponse {
  chunk_id: string;
  processing_latency_ms: number;
  sentiment: Sentiment;
  confidence: number;
  volatility_flag: boolean;
  hidden_intent: string;
  mitigation_suggestion: string;
  risk_level: RiskLevel;
  source: ClassificationSource;
  session_id: string | null;
}

export interface StreamItem {
  analysis: AnalysisResponse;
  chunk: ChunkRequest | null;
  httpRttMs: number | null;
}

const SENTIMENTS = new Set<string>([
  "positive",
  "negative",
  "neutral",
  "sarcastic",
  "aggressive",
  "deflecting",
  "appeasement",
]);

const RISKS = new Set<string>(["low", "medium", "high", "critical"]);
const SOURCES = new Set<string>(["groq", "gemini", "openai", "ollama", "cached", "heuristic"]);

export function parseAnalysis(raw: string): AnalysisResponse | null {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    if (typeof record.chunk_id !== "string") return null;
    if (typeof record.sentiment !== "string" || !SENTIMENTS.has(record.sentiment)) return null;
    if (typeof record.risk_level !== "string" || !RISKS.has(record.risk_level)) return null;
    if (typeof record.confidence !== "number") return null;
    if (typeof record.volatility_flag !== "boolean") return null;
    if (typeof record.hidden_intent !== "string") return null;
    if (typeof record.mitigation_suggestion !== "string") return null;
    if (typeof record.processing_latency_ms !== "number") return null;
    return {
      chunk_id: record.chunk_id,
      processing_latency_ms: record.processing_latency_ms,
      sentiment: record.sentiment as Sentiment,
      confidence: record.confidence,
      volatility_flag: record.volatility_flag,
      hidden_intent: record.hidden_intent,
      mitigation_suggestion: record.mitigation_suggestion,
      risk_level: record.risk_level as RiskLevel,
      source: typeof record.source === "string" && SOURCES.has(record.source) ? record.source as ClassificationSource : "heuristic",
      session_id: typeof record.session_id === "string" ? record.session_id : null,
    };
  } catch {
    return null;
  }
}
