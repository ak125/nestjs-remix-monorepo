/**
 * Mapping slug (snake/kebab) -> LucideIcon + Tailwind color tokens.
 * Source de verite cote DB : __diag_system.icon_slug + color_token.
 * Cette lib est uniquement presentational : aucune donnee metier.
 */
import {
  Snowflake,
  BatteryCharging,
  MoveHorizontal,
  Cog,
  Wind,
  Lightbulb,
  Disc3,
  Filter,
  Shield,
  Fuel,
  ThermometerSun,
  Car,
  Settings2,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  snowflake: Snowflake,
  "battery-charging": BatteryCharging,
  "move-horizontal": MoveHorizontal,
  cog: Cog,
  wind: Wind,
  lightbulb: Lightbulb,
  "disc-3": Disc3,
  filter: Filter,
  shield: Shield,
  fuel: Fuel,
  "thermometer-sun": ThermometerSun,
  car: Car,
  "settings-2": Settings2,
};

export function getDiagnosticIcon(slug: string | null | undefined): LucideIcon {
  if (!slug) return HelpCircle;
  return ICONS[slug] || HelpCircle;
}

const COLOR_CLASSES: Record<
  string,
  { bg: string; text: string; border: string; from: string; to: string }
> = {
  red: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    from: "from-red-500",
    to: "to-rose-600",
  },
  amber: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    from: "from-amber-500",
    to: "to-orange-600",
  },
  orange: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    from: "from-orange-500",
    to: "to-amber-600",
  },
  yellow: {
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    border: "border-yellow-200",
    from: "from-yellow-500",
    to: "to-amber-600",
  },
  emerald: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    from: "from-emerald-500",
    to: "to-teal-600",
  },
  teal: {
    bg: "bg-teal-50",
    text: "text-teal-700",
    border: "border-teal-200",
    from: "from-teal-500",
    to: "to-cyan-600",
  },
  cyan: {
    bg: "bg-cyan-50",
    text: "text-cyan-700",
    border: "border-cyan-200",
    from: "from-cyan-500",
    to: "to-teal-600",
  },
  sky: {
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200",
    from: "from-sky-500",
    to: "to-blue-600",
  },
  blue: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    from: "from-blue-500",
    to: "to-indigo-600",
  },
  indigo: {
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-indigo-200",
    from: "from-indigo-500",
    to: "to-purple-600",
  },
  purple: {
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
    from: "from-purple-500",
    to: "to-pink-600",
  },
  slate: {
    bg: "bg-slate-50",
    text: "text-slate-700",
    border: "border-slate-200",
    from: "from-slate-500",
    to: "to-slate-700",
  },
  stone: {
    bg: "bg-stone-50",
    text: "text-stone-700",
    border: "border-stone-200",
    from: "from-stone-500",
    to: "to-stone-700",
  },
};

export function getDiagnosticColor(
  token: string | null | undefined,
): (typeof COLOR_CLASSES)[string] {
  if (!token) return COLOR_CLASSES.slate;
  return COLOR_CLASSES[token] || COLOR_CLASSES.slate;
}
