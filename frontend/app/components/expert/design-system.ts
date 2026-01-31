/**
 * Pack Confiance V2 - Design System Configuration
 * @description Design tokens derived from ui-ux-pro-max + frontend-design skills
 * @version 2.0.0
 *
 * Style: Trust & Authority
 * Typography: Lexend (heading) + Source Sans 3 (body)
 * Anti-patterns: No generic fonts (Inter/Roboto), no AI purple gradients
 */

// ============================================================================
// COLOR PALETTE - Trust & Authority
// ============================================================================

export const COLORS = {
  // Primary - Trust Teal (distinctive, not generic green)
  primary: {
    50: "#F0FDFA",
    100: "#CCFBF1",
    200: "#99F6E4",
    300: "#5EEAD4",
    400: "#2DD4BF",
    500: "#14B8A6", // Secondary
    600: "#0D9488",
    700: "#0F766E", // PRIMARY
    800: "#115E59",
    900: "#134E4A", // Text
  },

  // CTA - Professional Blue (authority, action)
  cta: {
    light: "#BAE6FD",
    DEFAULT: "#0369A1",
    hover: "#075985",
    active: "#0C4A6E",
  },

  // Verified - Deep Green (not generic lime/emerald)
  verified: {
    light: "#D1FAE5",
    DEFAULT: "#059669",
    dark: "#047857",
    text: "#065F46",
  },

  // Urgency - Warm Red (not harsh)
  urgency: {
    light: "#FEE2E2",
    DEFAULT: "#DC2626",
    dark: "#B91C1C",
    text: "#991B1B",
  },

  // Warning - Amber (attention without alarm)
  warning: {
    light: "#FEF3C7",
    DEFAULT: "#D97706",
    dark: "#B45309",
    text: "#92400E",
  },

  // Neutral - Slate (professional, not gray)
  neutral: {
    50: "#F8FAFC",
    100: "#F1F5F9",
    200: "#E2E8F0",
    300: "#CBD5E1",
    400: "#94A3B8",
    500: "#64748B",
    600: "#475569",
    700: "#334155",
    800: "#1E293B",
    900: "#0F172A",
  },
} as const;

// ============================================================================
// TYPOGRAPHY - Lexend + Source Sans 3
// ============================================================================

export const TYPOGRAPHY = {
  fontFamily: {
    // Lexend: Corporate, trustworthy, accessible
    heading: "'Lexend', system-ui, sans-serif",
    // Source Sans 3: Professional, readable
    body: "'Source Sans 3', system-ui, sans-serif",
    // JetBrains Mono: Technical references
    mono: "'JetBrains Mono', 'Fira Code', monospace",
  },

  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  fontSize: {
    xs: ["0.75rem", { lineHeight: "1rem" }],
    sm: ["0.875rem", { lineHeight: "1.25rem" }],
    base: ["1rem", { lineHeight: "1.5rem" }],
    lg: ["1.125rem", { lineHeight: "1.75rem" }],
    xl: ["1.25rem", { lineHeight: "1.75rem" }],
    "2xl": ["1.5rem", { lineHeight: "2rem" }],
    "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
  },
} as const;

// ============================================================================
// EFFECTS & ANIMATIONS
// ============================================================================

export const EFFECTS = {
  // Transitions (150-300ms as per UX guidelines)
  transition: {
    fast: "150ms ease-out",
    normal: "200ms ease-out",
    slow: "300ms ease-out",
  },

  // Shadows (elevated trust elements)
  shadow: {
    sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    DEFAULT: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    // Trust elevation - subtle blue tint
    trust: "0 4px 14px -2px rgb(15 118 110 / 0.15)",
    // CTA elevation - blue glow
    cta: "0 4px 14px -2px rgb(3 105 161 / 0.25)",
  },

  // Border radius
  radius: {
    sm: "0.25rem",
    DEFAULT: "0.375rem",
    md: "0.5rem",
    lg: "0.75rem",
    xl: "1rem",
    full: "9999px",
  },
} as const;

// ============================================================================
// KEYFRAME ANIMATIONS
// ============================================================================

export const KEYFRAMES = {
  // Verified badge reveal
  "verified-reveal": {
    "0%": { transform: "scale(0)", opacity: "0" },
    "50%": { transform: "scale(1.1)" },
    "100%": { transform: "scale(1)", opacity: "1" },
  },

  // Metric pulse (for stock/compatibility)
  "metric-pulse": {
    "0%, 100%": { transform: "scale(1)", opacity: "1" },
    "50%": { transform: "scale(1.05)", opacity: "0.9" },
  },

  // Trust badge shimmer
  shimmer: {
    "0%": { backgroundPosition: "-200% 0" },
    "100%": { backgroundPosition: "200% 0" },
  },

  // Smooth stat reveal
  "stat-reveal": {
    "0%": { transform: "translateY(8px)", opacity: "0" },
    "100%": { transform: "translateY(0)", opacity: "1" },
  },

  // CTA attention pulse
  "cta-pulse": {
    "0%, 100%": { boxShadow: "0 0 0 0 rgb(3 105 161 / 0.4)" },
    "50%": { boxShadow: "0 0 0 8px rgb(3 105 161 / 0)" },
  },
} as const;

// ============================================================================
// COMPONENT TOKENS
// ============================================================================

export const COMPONENT_TOKENS = {
  // Trust Badge
  trustBadge: {
    padding: "0.5rem 0.75rem",
    borderRadius: "0.5rem",
    iconSize: "1.25rem",
    gap: "0.5rem",
  },

  // CTA Button
  ctaButton: {
    height: "3rem",
    paddingX: "1.5rem",
    borderRadius: "0.5rem",
    fontSize: "1rem",
    fontWeight: 600,
  },

  // Compatibility Badge
  compatibilityBadge: {
    height: "2rem",
    paddingX: "0.75rem",
    borderRadius: "9999px",
    fontSize: "0.875rem",
  },

  // Price Display
  priceDisplay: {
    fontSize: "1.5rem",
    fontWeight: 700,
    letterSpacing: "-0.025em",
  },
} as const;

// ============================================================================
// CSS CLASS GENERATORS
// ============================================================================

/**
 * Generate trust badge classes
 */
export function getTrustBadgeClasses(
  variant: "warranty" | "returns" | "secure" | "oem" | "delivery",
) {
  const variants = {
    warranty: {
      bg: "bg-primary-50",
      border: "border-primary-200",
      text: "text-primary-700",
      icon: "text-primary-600",
    },
    returns: {
      bg: "bg-slate-50",
      border: "border-slate-200",
      text: "text-slate-700",
      icon: "text-slate-600",
    },
    secure: {
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      text: "text-emerald-700",
      icon: "text-emerald-600",
    },
    oem: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-800",
      icon: "text-amber-600",
    },
    delivery: {
      bg: "bg-sky-50",
      border: "border-sky-200",
      text: "text-sky-700",
      icon: "text-sky-600",
    },
  };

  return variants[variant];
}

/**
 * Generate CTA button classes
 */
export function getCtaButtonClasses(
  variant: "primary" | "secondary" | "ghost",
) {
  const variants = {
    primary: [
      "bg-cta hover:bg-cta-hover active:bg-cta-active",
      "text-white font-semibold",
      "shadow-md hover:shadow-cta",
      "transition-all duration-200",
      "hover:-translate-y-0.5 active:translate-y-0",
    ].join(" "),
    secondary: [
      "bg-primary-50 hover:bg-primary-100",
      "text-primary-700 font-semibold",
      "border border-primary-200",
      "transition-all duration-200",
    ].join(" "),
    ghost: [
      "bg-transparent hover:bg-slate-100",
      "text-slate-700 font-medium",
      "transition-colors duration-200",
    ].join(" "),
  };

  return variants[variant];
}

// ============================================================================
// GOOGLE FONTS IMPORT
// ============================================================================

export const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&family=Source+Sans+3:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap";
