/**
 * ResultGarageReport — Bloc "Rapport garage" (PR-1a)
 *
 * Compose un résumé lisible (véhicule + symptômes + hypothèses + tests + pièces) à montrer
 * au garagiste. 100% CLIENT-SIDE et ÉPHÉMÈRE : rien n'est persisté (respecte OPTION A + NO-GO
 * Pilier B). Aucune donnée personnelle (pas de plaque, pas d'identité).
 */
import { ClipboardCheck, Copy, FileText } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { type Hypothesis, type SuggestedGamme, type WizardState } from "../types";

interface Props {
  vehicle: WizardState["vehicle"];
  symptomSlugs: string[];
  hypotheses: Hypothesis[];
  suggestedGammes: SuggestedGamme[];
  missing: string[];
}

function buildReport({
  vehicle,
  symptomSlugs,
  hypotheses,
  suggestedGammes,
  missing,
}: Props): string {
  const lines: string[] = [];
  lines.push("RAPPORT DIAGNOSTIC — AutoMecanik");
  lines.push("(à titre indicatif — à confirmer par un professionnel)");
  lines.push("");

  const veh = [
    vehicle.brand,
    vehicle.model,
    vehicle.year ? `${vehicle.year}` : "",
    vehicle.fuel,
    vehicle.mileage_km ? `${vehicle.mileage_km} km` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  lines.push(`Véhicule : ${veh || "non précisé"}`);

  if (symptomSlugs.length > 0) {
    lines.push(`Symptômes signalés : ${symptomSlugs.join(", ")}`);
  }
  lines.push("");

  lines.push("Hypothèses (par ordre de probabilité) :");
  hypotheses.slice(0, 5).forEach((h, i) => {
    lines.push(
      `  ${i + 1}. ${h.label} — score ${h.relative_score}/100 — urgence ${h.urgency}`,
    );
    if (h.verification_method) {
      lines.push(`     Vérification : ${h.verification_method}`);
    }
  });
  lines.push("");

  if (suggestedGammes.length > 0) {
    lines.push("Pièces possiblement concernées :");
    suggestedGammes.forEach((g) => lines.push(`  - ${g.gamme_label}`));
    lines.push("");
  }

  if (missing.length > 0) {
    lines.push("Informations manquantes (utiles pour affiner) :");
    missing.forEach((m) => lines.push(`  - ${m}`));
  }

  return lines.join("\n");
}

export function ResultGarageReport(props: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const text = buildReport(props);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [props]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          Rapport pour le garage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-gray-500">
          Un résumé à montrer à votre garagiste : véhicule, symptômes, hypothèses,
          vérifications et pièces possibles. Aucune donnée n&apos;est enregistrée.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="gap-1.5"
        >
          {copied ? (
            <>
              <ClipboardCheck className="w-3.5 h-3.5 text-green-600" />
              <span className="text-green-600">Copié</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copier le rapport
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
