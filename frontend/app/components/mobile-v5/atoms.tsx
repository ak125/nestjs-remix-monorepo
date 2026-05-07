/**
 * Mobile V5 atoms — composants visuels signature.
 *
 * Ces composants seront migrés vers leurs emplacements V4 finaux
 * (`components/home/`, `components/ecommerce/`, `components/cart/`)
 * après validation visuelle sur les routes /preview-mobile/*.
 */

import { Check, ChevronRight, type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

/* ─── Badge ───────────────────────────────────────────── */
export type MV5BadgeVariant =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "dark"
  | "promo"
  | "yellow";

export function MV5Badge({
  variant = "neutral",
  children,
}: {
  variant?: MV5BadgeVariant;
  children: ReactNode;
}) {
  return <span className={`mv5-badge mv5-badge-${variant}`}>{children}</span>;
}

/* ─── Pill ─────────────────────────────────────────────── */
export function MV5Pill({
  active,
  icon: Icon,
  children,
  onClick,
}: {
  active?: boolean;
  icon?: LucideIcon | null;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="mv5-pill"
      aria-pressed={active ?? false}
      onClick={onClick}
    >
      {Icon && <Icon size={14} aria-hidden="true" />}
      <span>{children}</span>
    </button>
  );
}

/* ─── HScroll ─────────────────────────────────────────── */
export function MV5HScroll({ children }: { children: ReactNode }) {
  return <div className="mv5-hscroll">{children}</div>;
}

/* ─── Section heading ─────────────────────────────────── */
export function MV5SectionHeading({
  eyebrow,
  title,
  action,
  onAction,
}: {
  eyebrow?: string;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="mv5-section-head">
      <div className="mv5-section-head-text">
        {eyebrow && <span className="mv5-eyebrow">{eyebrow}</span>}
        <h2 className="mv5-h2">{title}</h2>
      </div>
      {action && (
        <button
          type="button"
          className="mv5-btn mv5-btn-ghost mv5-btn-sm"
          onClick={onAction}
        >
          {action}
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/* ─── Stats band ──────────────────────────────────────── */
export function MV5StatsBand({
  items,
}: {
  items: { num: string; label: string }[];
}) {
  return (
    <div className="mv5-stats">
      {items.map((s, i) => (
        <div key={i}>
          <div className="mv5-stats-num">{s.num}</div>
          <div className="mv5-stats-label">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── Fitment band ────────────────────────────────────── */
export function MV5FitmentBand({
  label,
  sub,
  eyebrow = "Compatibilité confirmée",
  action,
}: {
  label: string;
  sub?: string | null;
  eyebrow?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="mv5-fitment-band">
      <Check size={20} strokeWidth={2.5} aria-hidden="true" />
      <div className="mv5-fitment-band-text">
        <span className="mv5-fitment-band-eyebrow">{eyebrow}</span>
        <span className="mv5-fitment-band-value">
          {label}
          {sub ? ` · ${sub}` : ""}
        </span>
      </div>
      {action && (
        <button
          type="button"
          className="mv5-btn mv5-btn-ghost mv5-btn-sm"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/* ─── Checkout steps ──────────────────────────────────── */
export function MV5CheckoutSteps({
  steps,
  active,
}: {
  steps: string[];
  active: number;
}) {
  return (
    <ol className="mv5-steps" aria-label="Étapes de commande">
      {steps.map((s, i) => (
        <li
          key={s}
          className={`mv5-step${i === active ? " is-active" : ""}`}
          aria-current={i === active ? "step" : undefined}
        >
          <span className="mv5-step-num">{i + 1}</span>
          <span className="mv5-step-label">{s}</span>
          {i < steps.length - 1 && (
            <span className="mv5-step-line" aria-hidden="true" />
          )}
        </li>
      ))}
    </ol>
  );
}

/* ─── Sticky CTA ──────────────────────────────────────── */
export function MV5StickyCTA({
  variant = "light",
  total,
  children,
}: {
  variant?: "light" | "dark";
  total?: { label: string; value: string };
  children: ReactNode;
}) {
  return (
    <div
      className={`mv5-sticky-cta${variant === "dark" ? " mv5-sticky-cta-dark" : ""}`}
    >
      {total && (
        <span className="mv5-sticky-cta-total">
          <span className="mv5-sticky-cta-total-label">{total.label}</span>
          <span className="mv5-sticky-cta-total-value">{total.value}</span>
        </span>
      )}
      {children}
    </div>
  );
}
