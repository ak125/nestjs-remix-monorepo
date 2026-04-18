/**
 * Route : /diagnostic-auto/wizard
 * Route dediee au DiagnosticWizard (contrat API inchange).
 *
 * Role SEO : R5 - DIAGNOSTIC (sous-surface interactive)
 */
import { type MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { ArrowLeft } from "lucide-react";

import { DiagnosticWizard } from "~/components/diagnostic-wizard/DiagnosticWizard";
import Container from "~/components/layout/Container";
import { PublicBreadcrumb } from "~/components/ui/PublicBreadcrumb";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";

export const handle = {
  pageRole: createPageRoleMeta(PageRole.R5_DIAGNOSTIC, {
    clusterId: "diagnostic",
    canonicalEntity: "diagnostic-auto-wizard",
  }),
};

export const meta: MetaFunction = () => [
  { title: "Diagnostic guidé — AutoMecanik" },
  {
    name: "description",
    content:
      "Outil interactif pour identifier une panne automobile. Renseignez votre véhicule et vos symptômes, obtenez hypothèses scorées, alertes sécurité et recommandations.",
  },
  { name: "robots", content: "index,follow" },
];

export default function DiagnosticAutoWizard() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <Container className="py-3">
          <PublicBreadcrumb
            items={[
              { label: "Accueil", href: "/" },
              { label: "Diagnostic Auto", href: "/diagnostic-auto" },
              { label: "Diagnostic guidé", href: "/diagnostic-auto/wizard" },
            ]}
          />
        </Container>
      </div>

      <Container className="py-8">
        <div className="mb-6">
          <Link
            to="/diagnostic-auto"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au diagnostic
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Diagnostic guidé</h1>
          <p className="text-muted-foreground max-w-2xl">
            Renseignez votre véhicule et les symptômes observés : notre moteur
            analyse les indices, score les hypothèses et vous oriente vers les
            vérifications à mener.
          </p>
        </div>

        <DiagnosticWizard />
      </Container>
    </div>
  );
}
