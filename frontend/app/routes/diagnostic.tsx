/**
 * Route : /diagnostic (noindex) — page publique liée depuis l'admin diagnostic.
 *
 * Embarque DiagnosticWizard (API /api/diagnostic-engine/*), comme /depannage et
 * /diagnostic-auto. L'ancien sélecteur de symptômes appelait /api/knowledge-graph/*,
 * servi par KnowledgeGraphModule, désactivé « DEV ONLY » dans app.module.ts :
 * la page affichait « Erreur de chargement des symptômes » partout.
 */

import { Search } from "lucide-react";
import { DiagnosticWizard } from "~/components/diagnostic-wizard/DiagnosticWizard";
import Container from "~/components/layout/Container";

// Meta
export const meta = () => [
  { title: "Diagnostic Auto - Trouvez la panne | Automecanik" },
  {
    name: "description",
    content:
      "Identifiez la panne de votre véhicule en sélectionnant les symptômes observés. Diagnostic intelligent avec recommandations de pièces.",
  },
  { name: "robots", content: "noindex, nofollow" },
];

// Component
export default function DiagnosticPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Container size="default" className="py-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-2">
            <Search className="h-8 w-8 text-blue-600" />
            Diagnostic Auto
          </h1>
          <p className="text-gray-600">
            Sélectionnez les symptômes observés sur votre véhicule pour
            identifier la panne probable
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <DiagnosticWizard />
        </div>

        {/* Info footer */}
        <div className="text-center text-sm text-gray-500 pt-4">
          <p>
            Ce diagnostic est fourni à titre indicatif et ne remplace pas l'avis
            d'un professionnel.
          </p>
        </div>
      </Container>
    </div>
  );
}
