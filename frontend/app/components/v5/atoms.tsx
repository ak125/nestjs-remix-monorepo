/**
 * V5 atoms — composants <100 lignes regroupés.
 * Plus gros : Header, BottomBar, Plaque, ProductCard, QuantityStepper en fichiers dédiés.
 */

import { Check, ChevronRight, type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

/* ─── Badge ───────────────────────────────────────────── */
export type V5BadgeVariant =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "dark"
  | "promo"
  | "yellow";

type BadgeProps = {
  variant?: V5BadgeVariant;
  children: ReactNode;
};

export function V5Badge({ variant = "neutral", children }: BadgeProps) {
  return <span className={`v5-badge v5-badge-${variant}`}>{children}</span>;
}

/* ─── Pill ─────────────────────────────────────────────── */
type PillProps = {
  active?: boolean;
  icon?: LucideIcon | null;
  children: ReactNode;
  onClick?: () => void;
};

export function V5Pill({ active, icon: Icon, children, onClick }: PillProps) {
  return (
    <button
      type="button"
      className="v5-pill"
      aria-pressed={active ?? false}
      onClick={onClick}
    >
      {Icon && <Icon size={14} aria-hidden="true" />}
      <span>{children}</span>
    </button>
  );
}

/* ─── HScroll ─────────────────────────────────────────── */
export function V5HScroll({ children }: { children: ReactNode }) {
  return <div className="v5-hscroll">{children}</div>;
}

/* ─── Section heading ─────────────────────────────────── */
type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  action?: string;
  onAction?: () => void;
};

export function V5SectionHeading({
  eyebrow,
  title,
  action,
  onAction,
}: SectionHeadingProps) {
  return (
    <div className="v5-section-head">
      <div className="v5-section-head-text">
        {eyebrow && <span className="v5-eyebrow">{eyebrow}</span>}
        <h2 className="v5-h2">{title}</h2>
      </div>
      {action && (
        <button
          type="button"
          className="v5-btn v5-btn-ghost v5-btn-sm v5-section-action"
          onClick={onAction}
        >
          {action}
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/* ─── StatsBand ───────────────────────────────────────── */
type StatsBandProps = {
  items: { num: string; label: string }[];
};

export function V5StatsBand({ items }: StatsBandProps) {
  return (
    <div className="v5-stats">
      {items.map((s, i) => (
        <div key={i}>
          <div className="v5-stats-num">{s.num}</div>
          <div className="v5-stats-label">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── FitmentBand ─────────────────────────────────────── */
type FitmentBandProps = {
  label: string;
  sub?: string | null;
  eyebrow?: string;
  action?: { label: string; onClick: () => void };
};

export function V5FitmentBand({
  label,
  sub,
  eyebrow = "Compatibilité confirmée",
  action,
}: FitmentBandProps) {
  return (
    <div className="v5-fitment-band">
      <Check size={20} strokeWidth={2.5} aria-hidden="true" />
      <div className="v5-fitment-band-text">
        <span className="v5-fitment-band-eyebrow">{eyebrow}</span>
        <span className="v5-fitment-band-value">
          {label}
          {sub ? ` · ${sub}` : ""}
        </span>
      </div>
      {action && (
        <button
          type="button"
          className="v5-btn v5-btn-ghost v5-btn-sm"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/* ─── CheckoutSteps ───────────────────────────────────── */
type CheckoutStepsProps = {
  steps: string[];
  active: number; // 0-based
};

export function V5CheckoutSteps({ steps, active }: CheckoutStepsProps) {
  return (
    <ol className="v5-steps" aria-label="Étapes de commande">
      {steps.map((s, i) => (
        <li
          key={s}
          className={`v5-step${i === active ? " is-active" : ""}`}
          aria-current={i === active ? "step" : undefined}
        >
          <span className="v5-step-num">{i + 1}</span>
          <span className="v5-step-label">{s}</span>
          {i < steps.length - 1 && (
            <span className="v5-step-line" aria-hidden="true" />
          )}
        </li>
      ))}
    </ol>
  );
}

/* ─── StickyCTA ───────────────────────────────────────── */
type StickyCTAProps = {
  variant?: "light" | "dark";
  total?: { label: string; value: string };
  children: ReactNode;
};

export function V5StickyCTA({
  variant = "light",
  total,
  children,
}: StickyCTAProps) {
  return (
    <div
      className={`v5-sticky-cta${variant === "dark" ? " v5-sticky-cta-dark" : ""}`}
    >
      {total && (
        <span className="v5-sticky-cta-total">
          <span className="v5-sticky-cta-total-label">{total.label}</span>
          <span className="v5-sticky-cta-total-value">{total.value}</span>
        </span>
      )}
      {children}
    </div>
  );
}
