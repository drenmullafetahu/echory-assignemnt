import { useEffect, useRef } from "react";
import type { ClassificationSource, StreamItem } from "../types";

interface SentimentStreamProps {
  items: StreamItem[];
}

const SOURCE_LABEL: Record<ClassificationSource, string> = {
  groq: "Groq",
  gemini: "Gemini",
  openai: "OpenAI",
  ollama: "Ollama",
  cached: "Cached",
  heuristic: "Heuristic",
};

function humanize(intent: string): string {
  const words = intent.replaceAll("_", " ").trim();
  return words.length > 0 ? `Live chunk. Reading: ${words}.` : "Live chunk.";
}

export function SentimentStream({ items }: SentimentStreamProps) {
  const latestRef = useRef<HTMLLIElement | null>(null);
  const ordered = [...items].reverse();

  useEffect(() => {
    latestRef.current?.scrollIntoView({ block: "nearest" });
  }, [items]);

  return (
    <section className="panel stream">
      <div className="panel-head">
        <p className="section-label">Live transcript</p>
        <p className="muted">
          {items.length === 0 ? "No turns yet" : `${items.length} ${items.length === 1 ? "turn" : "turns"}`}
        </p>
      </div>
      {items.length === 0 ? (
        <p className="empty">Type a custom turn, run the sample call, or stream chunks into port 3000.</p>
      ) : (
        <ol className="turns">
          {ordered.map((item, index) => {
            const session = item.analysis.session_id;
            const previousSession = index > 0 ? ordered[index - 1]?.analysis.session_id : null;
            const newSession = Boolean(session) && session !== previousSession;
            return (
              <li key={item.analysis.chunk_id} ref={index === 0 ? latestRef : undefined} className="turn-wrap">
                {newSession ? <p className="session-divider">Session {session}</p> : null}
                <div className={`turn risk-line-${item.analysis.risk_level}`}>
                  <div className="turn-meta">
                    <span className="speaker">{item.chunk?.speaker ?? "live"}</span>
                    <span className={`pill sentiment-${item.analysis.sentiment}`}>{item.analysis.sentiment}</span>
                    <span className={`pill source-${item.analysis.source}`}>{SOURCE_LABEL[item.analysis.source]}</span>
                    <span className="latency">backend {item.analysis.processing_latency_ms} ms</span>
                  </div>
                  <p className="utterance">{item.chunk?.text ?? humanize(item.analysis.hidden_intent)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
