/**
 * AudienceToggle — bascule "particulier / mécano" (PR-1a)
 *
 * Même diagnostic, deux niveaux de lecture. Ne change PAS les données : seul le rendu
 * (verbosité technique : scoring breakdown, vocabulaire) est ajusté en aval.
 */
/* eslint-disable no-restricted-syntax */ // print:hidden intentionnel (masquer le toggle à l'impression)
import { User, Wrench } from "lucide-react";

export type Audience = "particulier" | "mecano";

interface Props {
  value: Audience;
  onChange: (a: Audience) => void;
}

const OPTIONS: { id: Audience; label: string; icon: typeof User }[] = [
  { id: "particulier", label: "Particulier", icon: User },
  { id: "mecano", label: "Mécano", icon: Wrench },
];

export function AudienceToggle({ value, onChange }: Props) {
  return (
    <div
      className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 p-0.5 print:hidden"
      role="group"
      aria-label="Niveau de lecture du diagnostic"
    >
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={active}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              active
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
