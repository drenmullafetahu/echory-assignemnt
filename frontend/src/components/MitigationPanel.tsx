import { useEffect, useState } from "react";
import { WAITING_FOR_COUNTERPART } from "../say-next";
import type { Sentiment } from "../types";

interface MitigationPanelProps {
  suggestion: string | null;
  intent: string | null;
  triggeredBy: string | null;
  confidence: number | null;
  index: number;
  total: number;
  sentiments: Sentiment[];
  focused: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onFocus: () => void;
}

const DOT: Record<Sentiment, string> = {
  positive: "dot-positive",
  appeasement: "dot-appeasement",
  neutral: "dot-neutral",
  sarcastic: "dot-sarcastic",
  deflecting: "dot-deflecting",
  negative: "dot-negative",
  aggressive: "dot-aggressive",
};

export function MitigationPanel({
  suggestion,
  intent,
  triggeredBy,
  confidence,
  index,
  total,
  sentiments,
  focused,
  onPrevious,
  onNext,
  onFocus,
}: MitigationPanelProps) {
  const [copied, setCopied] = useState(false);
  const waiting = suggestion === null || suggestion === WAITING_FOR_COUNTERPART;
  const title = intent ? sentence(intent) : (suggestion ?? "Waiting for the counterpart");
  const quote = intent && suggestion && !waiting ? suggestion : null;
  const percent = confidence === null ? null : Math.round(confidence * 100);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy(): Promise<void> {
    if (!quote) return;
    try {
      await navigator.clipboard.writeText(quote);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="panel action-card">
      <div className="action-head">
        <p className="kicker">
          <span className="kicker-mark" aria-hidden="true" />
          Next best action
          {total > 0 ? <span className="kicker-count">{index}/{total}</span> : null}
        </p>
        {sentiments.length > 0 ? (
          <div className="dots" aria-label={`Recent sentiments: ${sentiments.join(", ")}`}>
            {sentiments.map((sentiment, dotIndex) => (
              <span key={`${sentiment}-${dotIndex}`} className={`dot ${DOT[sentiment]}`} />
            ))}
          </div>
        ) : null}
      </div>
      {quote ? <p className="action-name">{title}</p> : null}
      <p className="say-label">Say this next</p>
      <h2 className={quote ? "action-quote" : "action-quote is-waiting"}>
        {quote ? `“${quote}”` : title}
      </h2>
      <div className="confidence">
        <div className="confidence-label">
          <span>{percent === null ? "Match confidence" : `${percent}% match confidence`}</span>
        </div>
        <div className="confidence-track" aria-hidden="true">
          <span style={{ width: `${percent ?? 0}%` }} />
        </div>
      </div>
      <details className="why">
        <summary>Why</summary>
        <dl>
          <div>
            <dt>Reading</dt>
            <dd>{intent ?? "—"}</dd>
          </div>
          <div>
            <dt>Triggered by</dt>
            <dd>{triggeredBy ?? "—"}</dd>
          </div>
        </dl>
      </details>
      <div className="action-toolbar">
        <div className="action-toolbar-group">
          <button type="button" className="ghost" onClick={onPrevious} disabled={total === 0 || index <= 1}>
            Previous
          </button>
          <button type="button" className="btn-next" onClick={onNext} disabled={total === 0 || index >= total}>
            Next
          </button>
        </div>
        <div className="action-toolbar-group">
          <button type="button" className="ghost" onClick={() => void copy()} disabled={!quote}>
            {copied ? "Copied" : "Copy"}
          </button>
          <button type="button" className="simulate focus-toggle" onClick={onFocus} aria-pressed={focused}>
            {focused ? "Exit focus" : "Focus"}
          </button>
        </div>
      </div>
    </section>
  );
}

function sentence(intent: string): string {
  const words = intent.replaceAll("_", " ").trim();
  if (words.length === 0) return "Reading";
  return words.charAt(0).toUpperCase() + words.slice(1);
}
