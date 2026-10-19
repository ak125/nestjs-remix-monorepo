/** Display the evidence-qualified outcome; never infer success from legacy completed. */
const OUTCOMES: Record<string, { label: string; className: string }> = {
  pending: { label: "En attente", className: "bg-gray-100 text-gray-700" },
  processing: { label: "En cours", className: "bg-blue-100 text-blue-700" },
  disabled: {
    label: "Pipeline désactivé",
    className: "bg-gray-100 text-gray-700",
  },
  simulated: { label: "Simulation", className: "bg-amber-100 text-amber-700" },
  skipped: { label: "Rendu ignoré", className: "bg-gray-100 text-gray-700" },
  failed: { label: "Échec", className: "bg-red-100 text-red-700" },
  rendered_unverified: {
    label: "Rendu non vérifié",
    className: "bg-amber-100 text-amber-700",
  },
  rendered_checked: {
    label: "Rendu contrôlé",
    className: "bg-green-100 text-green-700",
  },
  unknown: {
    label: "Résultat indéterminé",
    className: "bg-gray-100 text-gray-700",
  },
};
export function executionPresentation(outcome: unknown) {
  return typeof outcome === "string" &&
    Object.prototype.hasOwnProperty.call(OUTCOMES, outcome)
    ? OUTCOMES[outcome]
    : OUTCOMES.unknown;
}
export function hasRenderedArtifact(outcome: unknown): boolean {
  return outcome === "rendered_unverified" || outcome === "rendered_checked";
}
