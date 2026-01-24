/**
 * Route : /diagnostic-auto/:slug
 * Page Diagnostic détail (R5 - DIAGNOSTIC) - Observable Pro
 *
 * Rôle SEO : R5 - DIAGNOSTIC
 * Intention : Identifier un symptôme
 *
 * Structure 3 niveaux :
 * - Symptom (60%) : Ce que le client ressent
 * - Sign (85%) : Ce que le technicien peut vérifier
 * - DTC (95%) : Codes OBD associés
 */

import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  Link,
  useLoaderData,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle,
  Clock,
  ExternalLink,
  HeartPulse,
  Info,
  Shield,
  ShoppingCart,
  Stethoscope,
  Wrench,
  XCircle,
  Eye,
  Cpu,
  AlertOctagon,
} from "lucide-react";

// UI Components
import { Error404 } from "~/components/errors/Error404";
import { HtmlContent } from "~/components/seo/HtmlContent";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { PublicBreadcrumb } from "~/components/ui/PublicBreadcrumb";

// SEO Page Role (Phase 5 - Quasi-Incopiable)
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";

/**
 * Handle export pour propager le rôle SEO au root Layout
 */
export const handle = {
  pageRole: createPageRoleMeta(PageRole.R5_DIAGNOSTIC, {
    clusterId: "diagnostic",
  }),
};

// Types
interface DiagnosticData {
  id: number;
  slug: string;
  title: string;
  meta_description: string;
  observable_type: "symptom" | "sign" | "dtc";
  perception_channel: string;
  risk_level: "confort" | "securite" | "critique";
  safety_gate: "none" | "warning" | "stop_soon" | "stop_immediate";
  symptom_description: string;
  sign_description: string;
  dtc_codes: string[];
  dtc_descriptions: Record<string, string>;
  ctx_phase: string[];
  ctx_temp: string[];
  ctx_freq: string;
  cluster_id: string;
  related_references: string[];
  related_gammes: number[];
  recommended_actions: Array<{
    action: string;
    urgency: string;
    skill_level: string;
    duration: string;
  }>;
  estimated_repair_cost_min: number;
  estimated_repair_cost_max: number;
  estimated_repair_duration: string;
  schema_org: object;
}

// Safety Gate Configuration
const SAFETY_GATE_CONFIG = {
  none: {
    icon: CheckCircle,
    color: "text-green-600",
    bg: "bg-green-50",
    label: "",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-yellow-600",
    bg: "bg-yellow-50",
    label: "⚠️ À surveiller",
  },
  stop_soon: {
    icon: AlertOctagon,
    color: "text-orange-600",
    bg: "bg-orange-50",
    label: "⚠️ Contrôle sous 24h",
  },
  stop_immediate: {
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-50",
    label: "⛔ NE PAS ROULER",
  },
};

// Risk level config
const RISK_CONFIG = {
  critique: {
    label: "Critique",
    color: "bg-red-100 text-red-800 border-red-300",
  },
  securite: {
    label: "Sécurité",
    color: "bg-orange-100 text-orange-800 border-orange-300",
  },
  confort: {
    label: "Confort",
    color: "bg-blue-100 text-blue-800 border-blue-300",
  },
};

// Urgency config
const URGENCY_CONFIG: Record<string, { label: string; color: string }> = {
  immediate: { label: "Immédiat", color: "text-red-600" },
  soon: { label: "Sous 48h", color: "text-orange-600" },
  scheduled: { label: "Planifier", color: "text-blue-600" },
};

// Skill level config
const SKILL_CONFIG: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  diy: { label: "Bricoleur", icon: Wrench },
  amateur: { label: "Amateur", icon: Wrench },
  professional: { label: "Professionnel", icon: Stethoscope },
};

// Context labels
const CTX_PHASE_LABELS: Record<string, string> = {
  demarrage: "🔵 Démarrage",
  ralenti: "🔵 Ralenti",
  acceleration: "🔵 Accélération",
  freinage: "🔵 Freinage",
  virage: "🔵 Virage",
  vitesse_stable: "🔵 Vitesse stable",
  arret: "🔵 À l'arrêt",
};

const CTX_TEMP_LABELS: Record<string, string> = {
  froid: "❄️ Moteur froid",
  chaud: "🔥 Moteur chaud",
};

const CTX_FREQ_LABELS: Record<string, string> = {
  intermittent: "🟡 Intermittent (probable: capteur/électronique)",
  permanent: "🔴 Permanent (probable: mécanique/usure)",
  progressif: "🟠 Progressif (probable: usure/fuite)",
  sporadique: "⚪ Sporadique (probable: électronique/température)",
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data?.diagnostic) {
    return [{ title: "Diagnostic non trouvé | AutoMekanik" }];
  }

  const { diagnostic } = data;
  const canonicalUrl = `https://www.automecanik.com/diagnostic-auto/${diagnostic.slug}`;

  return [
    { title: `${diagnostic.title} | Diagnostic Auto` },
    { name: "description", content: diagnostic.meta_description },
    { name: "robots", content: "index, follow" },
    // 🔗 Canonical URL (CRITIQUE SEO)
    { tagName: "link", rel: "canonical", href: canonicalUrl },
    // Open Graph
    { property: "og:title", content: diagnostic.title },
    { property: "og:description", content: diagnostic.meta_description },
    { property: "og:type", content: "article" },
    { property: "og:url", content: canonicalUrl },
  ];
};

export async function loader({ params }: LoaderFunctionArgs) {
  const { slug } = params;
  if (!slug) {
    throw new Response("Slug requis", { status: 400 });
  }

  const API_URL = process.env.VITE_API_URL || "http://localhost:3000";

  try {
    const response = await fetch(`${API_URL}/api/seo/diagnostic/${slug}`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Response("Diagnostic non trouvé", { status: 404 });
      }
      throw new Response("Erreur serveur", { status: response.status });
    }

    const data = await response.json();
    return json({ diagnostic: data.data as DiagnosticData });
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error("[diagnostic-auto.$slug] Loader error:", error);
    throw new Response("Erreur de chargement", { status: 500 });
  }
}

export default function DiagnosticAutoDetail() {
  const { diagnostic } = useLoaderData<typeof loader>();

  const safetyConfig =
    SAFETY_GATE_CONFIG[diagnostic.safety_gate] || SAFETY_GATE_CONFIG.none;
  const SafetyIcon = safetyConfig.icon;
  const riskConfig = RISK_CONFIG[diagnostic.risk_level] || RISK_CONFIG.confort;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Schema.org JSON-LD */}
      {diagnostic.schema_org && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(diagnostic.schema_org),
          }}
        />
      )}

      {/* Breadcrumbs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <PublicBreadcrumb
            items={[
              { label: "Accueil", href: "/" },
              { label: "Diagnostic Auto", href: "/diagnostic-auto" },
              {
                label: diagnostic.title,
                href: `/diagnostic-auto/${diagnostic.slug}`,
              },
            ]}
          />
        </div>
      </div>

      {/* Safety Gate Alert (si critique) */}
      {diagnostic.safety_gate !== "none" && (
        <div
          className={`${safetyConfig.bg} border-b-2 ${safetyConfig.color.replace("text-", "border-")}`}
        >
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <SafetyIcon className={`h-8 w-8 ${safetyConfig.color}`} />
              <div>
                <p className={`font-bold text-lg ${safetyConfig.color}`}>
                  {safetyConfig.label}
                </p>
                {diagnostic.safety_gate === "stop_immediate" && (
                  <p className="text-red-700">
                    En cas de situation critique, contactez un professionnel
                    immédiatement.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Link
            to="/diagnostic-auto"
            className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour aux diagnostics
          </Link>

          <div className="flex items-start gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Stethoscope className="h-8 w-8 text-purple-600" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                {diagnostic.title}
              </h1>
              <p className="text-gray-600 mt-2">
                {diagnostic.meta_description}
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                <Badge variant="outline" className={riskConfig.color}>
                  {riskConfig.label}
                </Badge>
                <Badge
                  variant="secondary"
                  className="bg-purple-50 text-purple-700"
                >
                  {diagnostic.cluster_id}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Colonne principale */}
          <div className="lg:col-span-2 space-y-6">
            {/* Section 1: Symptom (60%) - Ce que vous ressentez */}
            <Card className="border-l-4 border-l-yellow-500">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <HeartPulse className="h-6 w-6 text-yellow-600" />
                  <div>
                    <CardTitle className="text-lg">
                      🎧 Ce que vous ressentez
                    </CardTitle>
                    <p className="text-sm text-gray-500">
                      Symptôme - Fiabilité 60%
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <HtmlContent
                  html={diagnostic.symptom_description || ""}
                  className="prose prose-sm max-w-none"
                />
              </CardContent>
            </Card>

            {/* Section 2: Sign (85%) - Ce que le technicien vérifie */}
            <Card className="border-l-4 border-l-green-500">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Eye className="h-6 w-6 text-green-600" />
                  <div>
                    <CardTitle className="text-lg">
                      🔍 Ce que le technicien vérifie
                    </CardTitle>
                    <p className="text-sm text-gray-500">
                      Signe technique - Fiabilité 85%
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <HtmlContent
                  html={diagnostic.sign_description || ""}
                  className="prose prose-sm max-w-none"
                />
              </CardContent>
            </Card>

            {/* Section 3: DTC (95%) - Codes OBD associés */}
            {diagnostic.dtc_codes && diagnostic.dtc_codes.length > 0 && (
              <Card className="border-l-4 border-l-purple-500">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Cpu className="h-6 w-6 text-purple-600" />
                    <div>
                      <CardTitle className="text-lg">
                        💻 Codes OBD associés
                      </CardTitle>
                      <p className="text-sm text-gray-500">
                        Code DTC - Fiabilité 95%
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {diagnostic.dtc_codes.map((code) => (
                      <div
                        key={code}
                        className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                      >
                        <Badge
                          variant="outline"
                          className="font-mono bg-purple-100 text-purple-800"
                        >
                          {code}
                        </Badge>
                        <p className="text-sm text-gray-700">
                          {diagnostic.dtc_descriptions?.[code] ||
                            "Code diagnostic"}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Section 4: Contexte d'apparition */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="h-5 w-5 text-blue-600" />
                  ⚙️ Contexte d'apparition
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Phase de conduite */}
                  {diagnostic.ctx_phase && diagnostic.ctx_phase.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">Phase</h4>
                      <div className="flex flex-wrap gap-2">
                        {diagnostic.ctx_phase.map((phase) => (
                          <Badge key={phase} variant="secondary">
                            {CTX_PHASE_LABELS[phase] || phase}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Température */}
                  {diagnostic.ctx_temp && diagnostic.ctx_temp.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">
                        Température
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {diagnostic.ctx_temp.map((temp) => (
                          <Badge key={temp} variant="secondary">
                            {CTX_TEMP_LABELS[temp] || temp}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Fréquence */}
                  {diagnostic.ctx_freq && (
                    <div className="md:col-span-2">
                      <h4 className="font-medium text-gray-700 mb-2">
                        Fréquence
                      </h4>
                      <Badge variant="outline" className="text-sm">
                        {CTX_FREQ_LABELS[diagnostic.ctx_freq] ||
                          diagnostic.ctx_freq}
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Section 5: Actions recommandées */}
            {diagnostic.recommended_actions &&
              diagnostic.recommended_actions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Wrench className="h-5 w-5 text-gray-600" />
                      🛠️ Actions recommandées
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {diagnostic.recommended_actions.map((action, index) => {
                        const urgency =
                          URGENCY_CONFIG[action.urgency] ||
                          URGENCY_CONFIG.scheduled;
                        const skill =
                          SKILL_CONFIG[action.skill_level] || SKILL_CONFIG.diy;
                        const SkillIcon = skill.icon;

                        return (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-white rounded-full">
                                <SkillIcon className="h-4 w-4 text-gray-600" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">
                                  {action.action}
                                </p>
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                  <Clock className="h-3 w-3" />
                                  <span>{action.duration}</span>
                                  <span>•</span>
                                  <span>{skill.label}</span>
                                </div>
                              </div>
                            </div>
                            <Badge variant="outline" className={urgency.color}>
                              {urgency.label}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Estimation coûts */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">💰 Estimation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-900">
                    {diagnostic.estimated_repair_cost_min}€ -{" "}
                    {diagnostic.estimated_repair_cost_max}€
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Durée estimée : {diagnostic.estimated_repair_duration}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Liens R4 Référence */}
            {diagnostic.related_references &&
              diagnostic.related_references.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-blue-600" />
                      📖 Comprendre
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {diagnostic.related_references.map((ref) => (
                        <Link
                          key={ref}
                          to={`/reference-auto/${ref}`}
                          className="flex items-center justify-between p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          <span className="text-blue-700">
                            Référence : {ref.replace(/-/g, " ")}
                          </span>
                          <ExternalLink className="h-4 w-4 text-blue-600" />
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

            {/* Liens R1 Routeur - Trouver la pièce */}
            {diagnostic.related_gammes &&
              diagnostic.related_gammes.length > 0 && (
                <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-green-800">
                      <ShoppingCart className="h-5 w-5" />
                      🛒 Trouver la pièce
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-green-700 mb-4">
                      Sélectionnez votre véhicule pour trouver les pièces
                      compatibles
                    </p>
                    {diagnostic.related_gammes.map((pgId) => (
                      <Link
                        key={pgId}
                        to={`/pieces/gamme-${pgId}.html`}
                        className="block"
                      >
                        <Button className="w-full bg-green-600 hover:bg-green-700">
                          Voir les pièces
                          <ExternalLink className="h-4 w-4 ml-2" />
                        </Button>
                      </Link>
                    ))}
                  </CardContent>
                </Card>
              )}

            {/* Avertissement professionnel */}
            <Card className="bg-gray-100 border-gray-300">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-gray-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-gray-600">
                    <p className="font-medium mb-1">Avis professionnel</p>
                    <p>
                      Ce diagnostic est indicatif. Pour une analyse précise,
                      consultez un professionnel de l'automobile.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 404) {
    return <Error404 />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="max-w-md">
        <CardContent className="py-8 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Erreur de chargement
          </h2>
          <p className="text-gray-600 mb-4">
            Impossible de charger ce diagnostic. Veuillez réessayer.
          </p>
          <Link
            to="/diagnostic-auto"
            className="inline-flex items-center text-purple-600 hover:text-purple-700"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour aux diagnostics
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
