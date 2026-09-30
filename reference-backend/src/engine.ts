import type { AnalysisResponse, ChunkRequest, ClassifyFn, Draft, ProviderName, ResultSource } from "./types";
import { LruCache } from "./cache";
import { cacheKey, extractFeatures } from "./features";
import { heuristic } from "./fallback";
import { normalizeModelOutput } from "./llm/normalize";
import { isVolatile, ruleRisk, stricter } from "./risk";
import { SessionStore } from "./session-store";
import { roundConfidence, toIntent, truncate } from "./text";

export class AnalysisEngine {
  private readonly inflight = new Map<string, Promise<AnalysisResponse>>();

  constructor(
    readonly sessions: SessionStore,
    private readonly cache: LruCache<Draft>,
    private classify: ClassifyFn | null,
    private readonly timeoutMs: number,
    private provider: ProviderName,
    private readonly cacheEnabled: boolean,
  ) {}

  retarget(provider: ProviderName, classify: ClassifyFn | null): void {
    this.provider = provider;
    this.classify = classify;
    this.cache.clear();
  }

  analyzeAndRecord(chunk: ChunkRequest, startedAt: number): Promise<AnalysisResponse> {
    const key = `${chunk.session_id}:${chunk.chunk_id}`;
    const existing = this.inflight.get(key);
    if (existing) return existing;

    const promise = this.run(chunk, startedAt).finally(() => {
      this.inflight.delete(key);
    });
    this.inflight.set(key, promise);
    return promise;
  }

  private async run(chunk: ChunkRequest, startedAt: number): Promise<AnalysisResponse> {
    const features = extractFeatures(chunk);
    const previous = this.sessions.previous(chunk.session_id);
    const classify = this.classify;
    const provider = this.provider;
    const { draft, origin } = await this.draftFor(chunk, features, previous?.sentiment ?? null, classify);
    const volatility = isVolatile({
      features,
      sentiment: draft.sentiment,
      previous,
      timestampMs: chunk.timestamp_ms,
    }) || draft.modelVolatility;
    const result: AnalysisResponse = {
      chunk_id: chunk.chunk_id,
      session_id: chunk.session_id,
      processing_latency_ms: 0,
      sentiment: draft.sentiment,
      confidence: roundConfidence(draft.confidence),
      volatility_flag: volatility,
      hidden_intent: toIntent(draft.hiddenIntent),
      mitigation_suggestion: truncate(draft.mitigation, 120),
      risk_level: stricter(draft.modelRisk, ruleRisk(draft.sentiment, volatility)),
      source: provenance(origin, provider),
    };
    this.sessions.append(chunk, result, features.arousal);
    result.processing_latency_ms = Math.max(0, Math.ceil(performance.now() - startedAt));
    return result;
  }

  private async draftFor(
    chunk: ChunkRequest,
    features: ReturnType<typeof extractFeatures>,
    previousSentiment: Draft["sentiment"] | null,
    classify: ClassifyFn | null,
  ): Promise<{ draft: Draft; origin: "cached" | "llm" | "fallback" }> {
    const key = cacheKey(chunk.text, features, previousSentiment);
    if (this.cacheEnabled) {
      const cached = this.cache.get(key);
      if (cached) return { draft: cached, origin: "cached" };
    }

    const context = { chunk, features, previousSentiment };
    if (!classify) return { draft: heuristic(context), origin: "fallback" };

    const signal = AbortSignal.timeout(this.timeoutMs);
    try {
      const raw = await classify(context, signal);
      const draft = normalizeModelOutput(raw);
      if (this.cacheEnabled) this.cache.set(key, draft);
      return { draft, origin: "llm" };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown error";
      console.warn(`LLM classify failed (${chunk.chunk_id}: ${reason}); using heuristic`);
      return { draft: heuristic(context), origin: "fallback" };
    }
  }
}

function provenance(origin: "cached" | "llm" | "fallback", provider: ProviderName): ResultSource {
  if (origin === "cached") return "cached";
  if (origin === "fallback" || provider === "fallback") return "heuristic";
  return provider;
}
