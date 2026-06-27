/**
 * SoftCTA — Discrete compatibility/navigation link.
 * variant="hero" → white subtle (for use inside hero gradient)
 * variant="inline" → blue discrete (for use in article body)
 */

import { ArrowRight } from "lucide-react";
import { Link } from "react-router";

interface SoftCTAProps {
  label: string;
  href: string;
  variant?: "hero" | "inline";
}

export function SoftCTA({ label, href, variant = "inline" }: SoftCTAProps) {
  if (variant === "hero") {
    return (
      <Link
        to={href}
        className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-white underline decoration-white/30 underline-offset-4 transition-colors"
      >
        {label}
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    );
  }

  return (
    <Link
      to={href}
      className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
    >
      {label}
      <ArrowRight className="w-4 h-4" />
    </Link>
  );
}
