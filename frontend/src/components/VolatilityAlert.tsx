interface VolatilityAlertProps {
  active: boolean;
}

export function VolatilityAlert({ active }: VolatilityAlertProps) {
  if (!active) return null;
  return (
    <div className="volatility" role="alert">
      <strong>Tone shift</strong>
      <span>The tone just shifted. Slow down before you answer.</span>
    </div>
  );
}
