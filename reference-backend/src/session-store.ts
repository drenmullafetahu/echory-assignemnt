import type { AnalysisResponse, ChunkRequest, Sentiment, SessionSummary, StoredChunk } from "./types";

const MAX_CHUNKS = 500;

export class SessionStore {
  private readonly sessions = new Map<string, StoredChunk[]>();

  previous(sessionId: string): StoredChunk | null {
    const chunks = this.sessions.get(sessionId);
    if (!chunks || chunks.length === 0) return null;
    return chunks[chunks.length - 1] ?? null;
  }

  append(chunk: ChunkRequest, result: AnalysisResponse, arousal: number): void {
    const list = this.sessions.get(chunk.session_id) ?? [];
    list.push({
      chunk_id: result.chunk_id,
      timestamp_ms: chunk.timestamp_ms,
      speaker: chunk.speaker,
      text: chunk.text,
      sentiment: result.sentiment,
      risk_level: result.risk_level,
      volatility_flag: result.volatility_flag,
      hidden_intent: result.hidden_intent,
      arousal,
    });
    if (list.length > MAX_CHUNKS) list.splice(0, list.length - MAX_CHUNKS);
    this.sessions.set(chunk.session_id, list);
  }

  summary(sessionId: string): SessionSummary | null {
    const chunks = this.sessions.get(sessionId);
    if (!chunks || chunks.length === 0) return null;

    const volatileCount = chunks.filter((chunk) => chunk.volatility_flag).length;
    const counts = new Map<Sentiment, number>();
    for (const chunk of chunks) {
      counts.set(chunk.sentiment, (counts.get(chunk.sentiment) ?? 0) + 1);
    }
    const dominant = [...counts.entries()].sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      return left[0].localeCompare(right[0]);
    })[0]?.[0];
    if (!dominant) return null;

    const riskOrder: Record<StoredChunk["risk_level"], number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };
    const topRisk = chunks
      .filter((chunk) => chunk.risk_level === "critical" || chunk.risk_level === "high")
      .sort((left, right) => riskOrder[right.risk_level] - riskOrder[left.risk_level])
      .slice(0, 3)
      .map((chunk) => ({
        chunk_id: chunk.chunk_id,
        timestamp_ms: chunk.timestamp_ms,
        sentiment: chunk.sentiment,
        risk_level: chunk.risk_level,
        text_excerpt: chunk.hidden_intent,
      }));

    return {
      session_id: sessionId,
      chunk_count: chunks.length,
      aggregated_volatility_score: Math.round((volatileCount / chunks.length) * 100) / 100,
      dominant_sentiment: dominant,
      top_risk_moments: topRisk,
    };
  }
}
