import { ChevronLeft, Menu, type LucideIcon } from "lucide-react";

type RightIcon = {
  icon: LucideIcon;
  label: string;
  badge?: number | null;
  onClick?: () => void;
};

const LEFT_ICONS = {
  back: ChevronLeft,
  menu: Menu,
} as const;

export function MV5Header({
  title = "",
  light = false,
  leftIcon = "menu",
  leftLabel,
  onLeft,
  rightIcons = [],
}: {
  title?: string;
  light?: boolean;
  leftIcon?: "back" | "menu" | null;
  leftLabel?: string;
  onLeft?: () => void;
  rightIcons?: RightIcon[];
}) {
  const LeftIcon = leftIcon ? LEFT_ICONS[leftIcon] : null;
  const defaultLeftLabel =
    leftIcon === "back"
      ? "Retour"
      : leftIcon === "menu"
        ? "Ouvrir le menu"
        : "";

  return (
    <header className={`mv5-header${light ? " mv5-header-light" : ""}`}>
      {LeftIcon ? (
        <button
          type="button"
          className="mv5-icon-btn"
          onClick={onLeft}
          aria-label={leftLabel ?? defaultLeftLabel}
        >
          <LeftIcon size={22} aria-hidden="true" />
        </button>
      ) : (
        <span className="mv5-icon-btn" aria-hidden="true" />
      )}

      <h1 className="mv5-header-title">{title}</h1>

      {rightIcons.map((it, i) => {
        const Icon = it.icon;
        const ariaLabel =
          it.badge != null && it.badge > 0
            ? `${it.label} — ${it.badge}`
            : it.label;
        return (
          <button
            key={i}
            type="button"
            className="mv5-icon-btn"
            onClick={it.onClick}
            aria-label={ariaLabel}
          >
            <Icon size={22} aria-hidden="true" />
            {it.badge != null && it.badge > 0 && (
              <span className="mv5-header-badge" aria-hidden="true">
                {it.badge}
              </span>
            )}
          </button>
        );
      })}
    </header>
  );
}
