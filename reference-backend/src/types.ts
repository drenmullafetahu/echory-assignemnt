export const SENTIMENTS = [
  "positive",
  "negative",
  "neutral",
  "sarcastic",
  "aggressive",
  "deflecting",
  "appeasement",
] as const;

export const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;

export const SPEAKERS = ["candidate", "counterpart"] as const;

export type Sentiment = (typeof SENTIMENTS)[number];
export type RiskLevel = (typeof RISK_LEVELS)[number];
export type Speaker = (typeof SPEAKERS)[number];
export type ProviderName = "groq" | "gemini" | "openai" | "ollama" | "fallback";
export type ResultSource = "groq" | "gemini" | "openai" | "ollama" | "cached" | "heuristic";

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
  session_id: string;
  processing_latency_ms: number;
  sentiment: Sentiment;
  confidence: number;
  volatility_flag: boolean;
  hidden_intent: string;
  mitigation_suggestion: string;
  risk_level: RiskLevel;
  source: ResultSource;
}

export type PitchBin = "low" | "mid" | "high";
export type RateBin = "slow" | "moderate" | "fast" | "very_fast";
export type PauseBin = "short" | "medium" | "long";
export type VolumeBin = "low" | "mid" | "high";

export interface Features {
  pitch: number;
  wpm: number;
  pauseMs: number;
  volume: number;
  pitchBin: PitchBin;
  rateBin: RateBin;
  pauseBin: PauseBin;
  volumeBin: VolumeBin;
  arousal: number;
  concession: boolean;
  hedge: boolean;
  delay: boolean;
  intensifier: boolean;
  softener: boolean;
  positiveHits: number;
  negativeHits: number;
}

export interface ClassifyContext {
  chunk: ChunkRequest;
  features: Features;
  previousSentiment: Sentiment | null;
}

export type ClassifyFn = (context: ClassifyContext, signal: AbortSignal) => Promise<unknown>;

export interface Draft {
  sentiment: Sentiment;
  confidence: number;
  modelVolatility: boolean;
  hiddenIntent: string;
  mitigation: string;
  modelRisk: RiskLevel;
  source: "llm" | "fallback";
}

export interface StoredChunk {
  chunk_id: string;
  timestamp_ms: number;
  speaker: Speaker;
  text: string;
  sentiment: Sentiment;
  risk_level: RiskLevel;
  volatility_flag: boolean;
  hidden_intent: string;
  arousal: number;
}

export interface SessionSummary {
  session_id: string;
  chunk_count: number;
  aggregated_volatility_score: number;
  dominant_sentiment: Sentiment;
  top_risk_moments: Array<{
    chunk_id: string;
    timestamp_ms: number;
    sentiment: Sentiment;
    risk_level: RiskLevel;
    text_excerpt: string;
  }>;
}
