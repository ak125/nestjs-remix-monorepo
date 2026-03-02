/**
 * R1 "Erreurs fréquentes de compatibilité" — Checklist mode.
 * Orienté compat (pas symptômes, pas diagnostic).
 */
import { XCircle } from "lucide-react";

const DEFAULT_ERRORS = [
  "Confondre deux motorisations proches (ex : 1.6 HDi 90 ch vs 110 ch)",
  "Ignorer le code moteur indiqué en case D.2 de la carte grise",
  "Se fier uniquement au modèle sans vérifier le type exact",
  "Commander sans comparer la référence OE du constructeur",
];

export function R1CompatErrors({
  compatErrors,
  gammeName,
}: {
  compatErrors?: string[] | null;
  gammeName: string;
}) {
  const errors =
    compatErrors && compatErrors.length > 0 ? compatErrors : DEFAULT_ERRORS;

  return (
    <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 sm:p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-3">
        Erreurs à éviter avant de commander votre {gammeName}
      </h3>
      <ul className="space-y-2.5">
        {errors.slice(0, 4).map((error, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <XCircle className="w-4.5 h-4.5 text-rose-500 mt-0.5 shrink-0" />
            <span className="text-sm text-gray-700 leading-snug">{error}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
