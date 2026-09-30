import type { RiskLevel } from "../types";

const LAMPS: Array<{ level: RiskLevel; label: string }> = [
  { level: "low", label: "Low" },
  { level: "medium", label: "Medium" },
  { level: "high", label: "High" },
  { level: "critical", label: "Critical" },
];

interface TrafficLightProps {
  risk: RiskLevel | null;
  confidence: number | null;
  sentiment: string | null;
}

export function TrafficLight({ risk, confidence, sentiment }: TrafficLightProps) {
  const active = LAMPS.find((lamp) => lamp.level === risk);
  return (
    <section className="panel traffic" aria-live="polite">
      <p className="section-label">Insights</p>
      <div className="housing" role="img" aria-label={active ? `${active.label} risk` : "Standing by"}>
        {LAMPS.map((lamp) => (
          <span
            key={lamp.level}
            className={`lens lens-${lamp.level}${risk === lamp.level ? " is-lit" : ""}`}
          />
        ))}
      </div>
      <p className="risk-caption">Risk</p>
      <h2 className={risk ? `risk-word risk-${risk}` : "risk-word"}>{active?.label ?? "Standby"}</h2>
      {sentiment ? <p className={`pill sentiment-${sentiment}`}>{sentiment}</p> : null}
      <p className="muted">
        {confidence === null ? "Waiting for the first utterance." : `${Math.round(confidence * 100)}% confident`}
      </p>
    </section>
  );
}
