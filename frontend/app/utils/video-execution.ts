const OUTCOME_LABELS: Record<string, string> = {
  pending: "En attente",
  processing: "En cours",
  failed: "Échec",
  disabled: "Pipeline désactivé",
  simulated: "Simulation — aucun livrable",
  skipped: "Rendu non exécuté",
  rendered_unverified: "Rendu déclaré — fichier à vérifier",
  unknown: "Résultat non vérifié",
};

export function videoOutcomeLabel(outcome?: string): string {
  return OUTCOME_LABELS[outcome ?? "unknown"] ?? OUTCOME_LABELS.unknown;
}

export function canPreviewExecution(execution: {
  outcome?: string;
  renderOutputPath: string | null;
}): boolean {
  return (
    execution.outcome === "rendered_unverified" &&
    typeof execution.renderOutputPath === "string" &&
    execution.renderOutputPath.trim().length > 0
  );
}
