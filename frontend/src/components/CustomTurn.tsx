import { useState, type FormEvent, type KeyboardEvent } from "react";
import type { AcousticMetadata, Speaker } from "../types";

interface CustomTurnProps {
  busy: boolean;
  simulating: boolean;
  onSubmit: (input: { speaker: Speaker; text: string; acoustic: AcousticMetadata }) => Promise<void>;
  onNewSession: () => void;
}

const PITCH_DEFAULT = 0.24;
const RATE_DEFAULT = "130";
const PAUSE_DEFAULT = "400";
const VOLUME_DEFAULT = 0.4;

export function CustomTurn({ busy, simulating, onSubmit, onNewSession }: CustomTurnProps) {
  const [text, setText] = useState("");
  const [speaker, setSpeaker] = useState<Speaker>("counterpart");
  const [pitch, setPitch] = useState(PITCH_DEFAULT);
  const [rate, setRate] = useState(RATE_DEFAULT);
  const [pause, setPause] = useState(PAUSE_DEFAULT);
  const [volume, setVolume] = useState(VOLUME_DEFAULT);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    if (busy) return;
    const acoustic = readAcoustics(pitch, rate, pause, volume);
    if (typeof acoustic === "string") {
      setFormError(acoustic);
      return;
    }
    if (text.trim() === "") {
      setFormError("Enter a transcript to analyze.");
      return;
    }
    setFormError(null);
    try {
      await onSubmit({ speaker, text: text.trim(), acoustic });
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "The analysis request failed.");
    }
  }

  function onFormSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void submit();
  }

  function onTranscriptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <section className="panel composer">
      <div className="panel-head">
        <p className="section-label">Add a turn</p>
        <p className="muted">Cmd/Ctrl+Enter</p>
      </div>
      <form onSubmit={onFormSubmit}>
        <label className="field">
          <span>Transcript</span>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onTranscriptKeyDown}
            rows={4}
            placeholder="Type one negotiation turn"
            aria-label="Transcript"
            disabled={busy}
          />
        </label>
        <label className="field speaker-field">
          <span>Speaker</span>
          <select
            aria-label="Speaker"
            value={speaker}
            disabled={busy}
            onChange={(event) => setSpeaker(event.target.value as Speaker)}
          >
            <option value="candidate">candidate</option>
            <option value="counterpart">counterpart</option>
          </select>
        </label>
        <details className="voice-settings">
          <summary>Simulated voice settings</summary>
          <p className="voice-note">
            These are values you supply by hand, not measurements extracted from the text. The starting numbers are demo defaults.
          </p>
          <div className="voice-grid">
            <label className="field">
              <span>Pitch volatility <strong>{pitch.toFixed(2)}</strong> <em>0–1</em></span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={pitch}
                aria-label="Pitch volatility"
                disabled={busy}
                onChange={(event) => setPitch(Number(event.target.value))}
              />
            </label>
            <label className="field">
              <span>Speaking rate <strong>{shownNumber(rate)}</strong> <em>wpm</em></span>
              <input
                type="number"
                min={0}
                step={1}
                inputMode="decimal"
                value={rate}
                aria-label="Speaking rate in words per minute"
                disabled={busy}
                onChange={(event) => setRate(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Pause before speaking <strong>{shownNumber(pause)}</strong> <em>ms</em></span>
              <input
                type="number"
                min={0}
                step={1}
                inputMode="decimal"
                value={pause}
                aria-label="Pause before speaking in milliseconds"
                disabled={busy}
                onChange={(event) => setPause(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Volume intensity <strong>{volume.toFixed(2)}</strong> <em>0–1</em></span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                aria-label="Volume intensity"
                disabled={busy}
                onChange={(event) => setVolume(Number(event.target.value))}
              />
            </label>
          </div>
        </details>
        {formError ? <p className="error composer-error" role="alert">{formError}</p> : null}
        <div className="composer-actions">
          <button type="submit" className="simulate" disabled={busy} aria-busy={busy}>
            {busy && !simulating ? "Analyzing" : "Analyze"}
          </button>
          <button type="button" className="ghost" onClick={onNewSession} disabled={simulating}>
            New session
          </button>
        </div>
      </form>
    </section>
  );
}

function shownNumber(value: string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : "—";
}

function readAcoustics(pitch: number, rate: string, pause: string, volume: number): AcousticMetadata | string {
  if (!Number.isFinite(pitch) || pitch < 0 || pitch > 1) return "Pitch volatility must be a number from 0 to 1.";
  const speechRate = Number(rate);
  if (rate.trim() === "" || !Number.isFinite(speechRate)) return "Speaking rate must be a finite number.";
  if (speechRate < 0) return "Speaking rate must be zero or greater.";
  const pauseMs = Number(pause);
  if (pause.trim() === "" || !Number.isFinite(pauseMs)) return "Pause must be a finite number.";
  if (pauseMs < 0) return "Pause must be zero or greater.";
  if (!Number.isFinite(volume) || volume < 0 || volume > 1) return "Volume intensity must be a number from 0 to 1.";
  return {
    pitch_volatility: pitch,
    speech_rate_wpm: speechRate,
    pause_duration_ms: pauseMs,
    volume_intensity: volume,
  };
}
