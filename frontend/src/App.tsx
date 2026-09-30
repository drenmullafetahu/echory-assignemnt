import { useEffect, useState } from "react";
import { AcousticMeters } from "./components/AcousticMeters";
import { CustomTurn } from "./components/CustomTurn";
import { MitigationPanel } from "./components/MitigationPanel";
import { SentimentStream } from "./components/SentimentStream";
import { TrafficLight } from "./components/TrafficLight";
import { VolatilityAlert } from "./components/VolatilityAlert";
import { useTelemetry } from "./hooks/useTelemetry";
import { TRIGGERED_BY_COUNTERPART, sayNext } from "./say-next";
import type { ClassificationSource, StreamItem } from "./types";

function parseEngine(body: unknown): EngineStatus | null {
  if (!body || typeof body !== "object") return null;
  const record = body as { provider?: unknown; model?: unknown; options?: unknown };
  if (typeof record.provider !== "string" || !Array.isArray(record.options)) return null;
  const options = record.options.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const choice = item as { id?: unknown; label?: unknown; available?: unknown; models?: unknown };
    if (typeof choice.id !== "string" || typeof choice.label !== "string" || typeof choice.available !== "boolean") return [];
    const models = Array.isArray(choice.models) ? choice.models.filter((model): model is string => typeof model === "string") : [];
    return [{ id: choice.id, label: choice.label, available: choice.available, models }];
  });
  return {
    provider: record.provider,
    model: typeof record.model === "string" && record.model.length > 0 ? record.model : null,
    options,
  };
}

interface ProviderChoice {
  id: string;
  label: string;
  available: boolean;
  models: string[];
}

interface EngineStatus {
  provider: string;
  model: string | null;
  options: ProviderChoice[];
}

const SOURCE_LABEL: Record<ClassificationSource, string> = {
  groq: "Groq",
  gemini: "Gemini",
  openai: "OpenAI",
  ollama: "Ollama",
  cached: "Cached",
  heuristic: "Heuristic",
};

export function App() {
  const { items, latest, connected, simulating, submitting, error, sessionId, simulate, newSession, submitCustom } = useTelemetry();
  const [engine, setEngine] = useState<EngineStatus | null>(null);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const risk = latest?.analysis.risk_level ?? null;
  const advice = sayNext(items);
  const history = items.filter((item) => item.chunk?.speaker === "counterpart");
  const latestCounterpart = history.length > 0 ? history[history.length - 1] ?? null : null;
  const viewed = pinnedId ? history.find((item) => item.analysis.chunk_id === pinnedId) ?? null : null;
  const browsing = viewed !== null;
  const shownIndex = browsing
    ? history.findIndex((item) => item.analysis.chunk_id === viewed.analysis.chunk_id)
    : history.length - 1;
  const suggestion = browsing ? viewed.analysis.mitigation_suggestion : advice.suggestion;
  const intent = browsing ? viewed.analysis.hidden_intent : advice.intent;
  const triggeredBy = browsing ? TRIGGERED_BY_COUNTERPART : advice.triggeredBy;
  const confidence = browsing
    ? viewed.analysis.confidence
    : latestCounterpart?.analysis.confidence ?? null;

  useEffect(() => {
    setPinnedId(null);
  }, [latestCounterpart?.analysis.chunk_id]);

  useEffect(() => {
    let stopped = false;
    void fetch("/api/engine")
      .then(async (response) => (response.ok ? await response.json() as unknown : null))
      .then((body) => {
        const parsed = parseEngine(body);
        if (!stopped && parsed) setEngine(parsed);
      })
      .catch(() => {
        if (!stopped) setEngine(null);
      });
    return () => {
      stopped = true;
    };
  }, []);

  async function choose(provider: string, model: string | null): Promise<void> {
    setSwitching(true);
    setSwitchError(null);
    try {
      const response = await fetch("/api/engine", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, model }),
      });
      const body = await response.json() as unknown;
      const parsed = parseEngine(body);
      if (!response.ok || !parsed) {
        const message = body && typeof body === "object" && "error" in body && typeof body.error === "string"
          ? body.error
          : "Could not switch the model.";
        setSwitchError(message);
        return;
      }
      setEngine(parsed);
    } catch {
      setSwitchError("Could not reach the engine.");
    } finally {
      setSwitching(false);
    }
  }

  function showPrevious(): void {
    const index = browsing ? shownIndex : history.length - 1;
    const previous = history[index - 1];
    if (previous) setPinnedId(previous.analysis.chunk_id);
  }

  function showNext(): void {
    if (!browsing) return;
    const following = history[shownIndex + 1];
    if (!following) return;
    if (shownIndex + 1 >= history.length - 1) setPinnedId(null);
    else setPinnedId(following.analysis.chunk_id);
  }

  const selected = engine?.options.find((choice) => choice.id === engine.provider) ?? null;
  const models = selected?.models ?? [];
  const position = history.length === 0 || shownIndex < 0 ? 0 : shownIndex + 1;
  const sentiments = items.slice(-5).map((item) => item.analysis.sentiment);

  return (
    <div className={focused ? "page is-focus" : "page"}>
      <header className="topbar">
        <div className="identity">
          <span className="identity-mark" aria-hidden="true" />
          <div className="identity-copy">
            <strong>Live negotiation</strong>
            <span className="identity-session">{sessionId}</span>
          </div>
          <span className={connected ? "live-pill is-on" : "live-pill"}>{connected ? "Live" : "Reconnecting"}</span>
        </div>
        <div className="top-actions">
          <span className="model-chip">{engine?.model ?? selected?.label ?? "Model"}</span>
          <button type="button" className="simulate" onClick={() => void simulate()} disabled={simulating || submitting || !connected}>
            {simulating ? "Call in progress" : "Run sample call"}
          </button>
          <button type="button" className="ghost" onClick={newSession} disabled={simulating}>
            New session
          </button>
        </div>
      </header>

      <div className="columns">
        <div className="col-side">
          <CustomTurn busy={simulating || submitting} simulating={simulating} onSubmit={submitCustom} onNewSession={newSession} />
          <TrafficLight risk={risk} confidence={latest?.analysis.confidence ?? null} sentiment={latest?.analysis.sentiment ?? null} />
          <SentimentStream items={items} />
        </div>

        <main className="col-main">
          <VolatilityAlert active={latest?.analysis.volatility_flag ?? false} />
          {error ? <p className="error">{error}</p> : null}
          {switchError ? <p className="error">{switchError}</p> : null}
          <MitigationPanel
            suggestion={suggestion}
            intent={intent}
            triggeredBy={triggeredBy}
            confidence={history.length === 0 ? null : confidence}
            index={position}
            total={history.length}
            sentiments={sentiments}
            focused={focused}
            onPrevious={showPrevious}
            onNext={showNext}
            onFocus={() => setFocused((current) => !current)}
          />
          <section className="panel live-state">
            <p className="section-label">
              <span className={connected ? "state-dot is-on" : "state-dot"} aria-hidden="true" />
              Live state
            </p>
            <p>{describe(latest)}</p>
            {latest ? (
              <p className="live-meta">
                {SOURCE_LABEL[latest.analysis.source]} · backend {latest.analysis.processing_latency_ms} ms
              </p>
            ) : null}
          </section>
        </main>

        <aside className="col-rail">
          <AcousticMeters acoustic={latest?.chunk?.acoustic_metadata ?? null} />
          <section className="panel engine-card">
            <p className="section-label">Model</p>
            <label>
              AI
              <select
                aria-label="AI provider"
                value={engine?.provider ?? ""}
                disabled={!engine || switching || simulating || submitting}
                onChange={(event) => {
                  const next = engine?.options.find((choice) => choice.id === event.target.value);
                  if (!next) return;
                  void choose(next.id, next.models[0] ?? null);
                }}
              >
                {!engine ? <option value="">Loading</option> : null}
                {(engine?.options ?? []).map((choice) => (
                  <option key={choice.id} value={choice.id} disabled={!choice.available}>
                    {choice.available ? choice.label : `${choice.label} unavailable`}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Model
              <select
                aria-label="Model"
                value={engine?.model ?? ""}
                disabled={!engine || switching || simulating || submitting || models.length === 0}
                onChange={(event) => {
                  if (!engine) return;
                  void choose(engine.provider, event.target.value);
                }}
              >
                {models.length === 0 ? <option value="">Local rules</option> : null}
                {models.map((model) => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </label>
          </section>
          <section className="panel nudge">
            <p className="section-label">Focus nudge</p>
            <p>{nudge(latest, advice.intent)}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function describe(latest: StreamItem | null): string {
  if (!latest) return "The call state will appear here after the first turn is classified.";
  const speaker = latest.chunk?.speaker === "candidate"
    ? "The candidate"
    : latest.chunk?.speaker === "counterpart"
      ? "The counterpart"
      : "The latest speaker";
  const intent = latest.analysis.hidden_intent.replaceAll("_", " ");
  const shift = latest.analysis.volatility_flag ? " The tone just shifted." : "";
  return `${speaker} sounds ${latest.analysis.sentiment}. The reading is ${intent}, and the risk is ${latest.analysis.risk_level}.${shift}`;
}

function nudge(latest: StreamItem | null, intent: string | null): string {
  if (latest?.analysis.volatility_flag) return "The tone just shifted. Slow down before you answer.";
  if (intent) return `Listen for ${intent.replaceAll("_", " ")}.`;
  return "A nudge will appear when a turn is classified.";
}
