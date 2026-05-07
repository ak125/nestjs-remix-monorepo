export function MV5QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  label = "Quantité",
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  label?: string;
}) {
  const labelLower = label.toLowerCase();

  return (
    <div className="mv5-stepper" role="group" aria-label={label}>
      <button
        type="button"
        className="mv5-stepper-btn"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`Diminuer la ${labelLower}`}
      >
        −
      </button>
      <span
        className="mv5-stepper-val"
        aria-live="polite"
        aria-label={`${label} : ${value}`}
      >
        {value}
      </span>
      <button
        type="button"
        className="mv5-stepper-btn"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`Augmenter la ${labelLower}`}
      >
        +
      </button>
    </div>
  );
}
