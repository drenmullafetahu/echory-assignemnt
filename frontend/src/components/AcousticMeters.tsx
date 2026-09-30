import type { AcousticMetadata } from "../types";

interface AcousticMetersProps {
  acoustic: AcousticMetadata | null;
}

const ROWS: Array<{ key: keyof AcousticMetadata; label: string; max: number; unit: string }> = [
  { key: "pitch_volatility", label: "Pitch volatility", max: 1, unit: "" },
  { key: "speech_rate_wpm", label: "Rate", max: 220, unit: " wpm" },
  { key: "pause_duration_ms", label: "Pause", max: 1200, unit: " ms" },
  { key: "volume_intensity", label: "Volume", max: 1, unit: "" },
];

export function AcousticMeters({ acoustic }: AcousticMetersProps) {
  return (
    <section className="panel meters">
      <p className="section-label">Voice</p>
      {ROWS.map((row) => {
        const value = acoustic ? acoustic[row.key] : 0;
        const width = Math.max(0, Math.min(100, (value / row.max) * 100));
        const shown = acoustic
          ? row.max === 1
            ? value.toFixed(2)
            : `${Math.round(value)}${row.unit}`
          : "—";
        return (
          <div key={row.key} className="meter">
            <div className="meter-label">
              <span>{row.label}</span>
              <span>{shown}</span>
            </div>
            <div className="meter-track">
              <span style={{ width: `${acoustic ? width : 0}%` }} />
            </div>
          </div>
        );
      })}
    </section>
  );
}
