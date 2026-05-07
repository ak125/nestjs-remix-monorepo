type QuantityStepperProps = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  label?: string;
};

export function V5QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  label = "Quantité",
}: QuantityStepperProps) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));

  return (
    <div className="v5-stepper" role="group" aria-label={label}>
      <button
        type="button"
        className="v5-stepper-btn"
        onClick={dec}
        disabled={value <= min}
        aria-label={`Diminuer la ${label.toLowerCase()}`}
      >
        −
      </button>
      <span
        className="v5-stepper-val"
        aria-live="polite"
        aria-label={`${label} : ${value}`}
      >
        {value}
      </span>
      <button
        type="button"
        className="v5-stepper-btn"
        onClick={inc}
        disabled={value >= max}
        aria-label={`Augmenter la ${label.toLowerCase()}`}
      >
        +
      </button>
    </div>
  );
}
