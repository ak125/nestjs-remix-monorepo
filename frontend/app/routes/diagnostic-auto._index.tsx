/**
 * Route : /diagnostic-auto
 * Index des pages Diagnostic (R5 - DIAGNOSTIC) - Observable Pro
 *
 * Rôle SEO : R5 - DIAGNOSTIC
 * Intention : Identifier un symptôme
 *
 * Affiche les diagnostics organisés par cluster (embrayage, freinage, moteur...)
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
  Search,
  Stethoscope,
  ChevronRight,
  Shield,
  Car,
  Wrench,
  Volume2,
  Eye,
  Gauge,
  Zap,
  ThermometerSun,
} from "lucide-react";
import { useState } from "react";

// UI Components
import { Error404 } from "~/components/errors/Error404";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { PublicBreadcrumb } from "~/components/ui/PublicBreadcrumb";

// SEO Page Role (Phase 5 - Quasi-Incopiable)
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";

/**
 * Handle export pour propager le rôle SEO au root Layout
 */
export const handle = {
  pageRole: createPageRoleMeta(PageRole.R5_DIAGNOSTIC, {
    clusterId: "diagnostic",
    canonicalEntity: "diagnostic-auto",
  }),
};

// Types
interface DiagnosticItem {
  slug: string;
  title: string;
  meta_description: string;
  observable_type: "symptom" | "sign" | "dtc";
  perception_channel: string;
  risk_level: "confort" | "securite" | "critique";
  safety_gate: "none" | "warning" | "stop_soon" | "stop_immediate";
  cluster_id: string;
}

interface ClusterInfo {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

// Clusters de diagnostic
const CLUSTERS: ClusterInfo[] = [
  {
    id: "embrayage",
    label: "Embrayage",
    icon: Wrench,
    description: "Bruits, vibrations, patinage",
  },
  {
    id: "freinage",
    label: "Freinage",
    icon: Shield,
    description: "Bruits de freins, vibrations, efficacité",
  },
  {
    id: "moteur",
    label: "Moteur",
    icon: Gauge,
    description: "Bruits moteur, fumées, pertes de puissance",
  },
  {
    id: "suspension",
    label: "Suspension",
    icon: Car,
    description: "Bruits de suspension, tenue de route",
  },
  {
    id: "electricite",
    label: "Électricité",
    icon: Zap,
    description: "Voyants, pannes électriques, batterie",
  },
  {
    id: "refroidissement",
    label: "Refroidissement",
    icon: ThermometerSun,
    description: "Surchauffe, fuites, ventilateur",
  },
];

// Mapping des icônes de perception
const PERCEPTION_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  auditory: Volume2,
  visual: Eye,
  tactile: Wrench,
  performance: Gauge,
  electronic: Zap,
  olfactory: ThermometerSun,
};

export const meta: MetaFunction = () => {
  const canonicalUrl = "https://www.automecanik.com/diagnostic-auto";

  return [
    { title: "Diagnostic Auto : Symptômes et Causes | AutoMekanik" },
    {
      name: "description",
      content:
        "Identifiez les symptômes de votre véhicule : bruits, vibrations, voyants. Diagnostic professionnel avec causes probables et solutions.",
    },
    { name: "robots", content: "index, follow" },
    // 🔗 Canonical URL (CRITIQUE SEO)
    { tagName: "link", rel: "canonical", href: canonicalUrl },
    // Open Graph
    { property: "og:title", content: "Diagnostic Auto : Symptômes et Causes" },
    {
      property: "og:description",
      content:
        "Identifiez les symptômes de votre véhicule : bruits, vibrations, voyants. Diagnostic professionnel avec causes probables et solutions.",
    },
    { property: "og:type", content: "website" },
    { property: "og:url", content: canonicalUrl },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const API_URL = process.env.VITE_API_URL || "http://127.0.0.1:3000";

  try {
    // Récupérer les diagnostics les plus consultés
    const response = await fetch(`${API_URL}/api/seo/diagnostic/featured`, {
      headers: {
        Accept: "application/json",
      },
    });

    let featured: DiagnosticItem[] = [];
    if (response.ok) {
      const data = await response.json();
      featured = data?.data || [];
    }

    // Générer le FAQPage Schema pour la page index
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: featured.slice(0, 5).map((d) => ({
        "@type": "Question",
        name: `Qu'est-ce qu'un ${d.title.split(":")[0].trim()} ?`,
        acceptedAnswer: {
          "@type": "Answer",
          text:
            d.meta_description ||
            `Le ${d.title.split(":")[0].trim().toLowerCase()} est un symptôme automobile qui peut indiquer un problème de ${d.cluster_id || "mécanique"}.`,
        },
      })),
    };

    return json({ featured, faqSchema });
  } catch (error) {
    console.error("[diagnostic-auto._index] Loader error:", error);
    return json({ featured: [], faqSchema: null });
  }
}

// Fonction pour le badge de risque
function RiskBadge({ level }: { level: string }) {
  const config = {
    critique: {
      label: "Critique",
      className: "bg-red-100 text-red-800 border-red-300",
    },
    securite: {
      label: "Sécurité",
      className: "bg-orange-100 text-orange-800 border-orange-300",
    },
    confort: {
      label: "Confort",
      className: "bg-blue-100 text-blue-800 border-blue-300",
    },
  };
  const { label, className } =
    config[level as keyof typeof config] || config.confort;
  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}

// Fonction pour le badge de type observable
function ObservableTypeBadge({ type }: { type: string }) {
  const config = {
    symptom: {
      label: "Symptôme",
      confidence: "60%",
      className: "bg-yellow-50 text-yellow-700",
    },
    sign: {
      label: "Signe",
      confidence: "85%",
      className: "bg-green-50 text-green-700",
    },
    dtc: {
      label: "Code OBD",
      confidence: "95%",
      className: "bg-purple-50 text-purple-700",
    },
  };
  const { label, confidence, className } =
    config[type as keyof typeof config] || config.symptom;
  return (
    <Badge variant="secondary" className={className}>
      {label} ({confidence})
    </Badge>
  );
}

export default function DiagnosticAutoIndex() {
  const { featured, faqSchema } = useLoaderData<typeof loader>();
  const [searchQuery, setSearchQuery] = useState("");

  // Utiliser CLUSTERS directement (pas via loader car les icônes ne sont pas sérialisables)
  const clusters = CLUSTERS;

  const filteredClusters = clusters.filter(
    (cluster) =>
      cluster.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cluster.description.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Schema.org FAQPage JSON-LD (Rich Snippets Google) */}
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(faqSchema),
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
            ]}
          />
        </div>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="flex items-center gap-4 mb-4">
            <Stethoscope className="h-12 w-12" />
            <h1 className="text-3xl font-bold">Diagnostic Auto</h1>
          </div>
          <p className="text-lg text-purple-100 max-w-2xl">
            Identifiez les symptômes de votre véhicule et découvrez les causes
            probables. Notre système utilise 3 niveaux de fiabilité : symptômes
            ressentis, signes techniques et codes OBD.
          </p>

          {/* Barre de recherche */}
          <div className="mt-8 max-w-xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="search"
                placeholder="Rechercher un symptôme (ex: bruit embrayage, vibration frein...)"
                className="pl-10 bg-white text-gray-900"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Légende des 3 niveaux */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-6 justify-center">
              <div className="flex items-center gap-2">
                <ObservableTypeBadge type="symptom" />
                <span className="text-sm text-gray-600">Ressenti client</span>
              </div>
              <div className="flex items-center gap-2">
                <ObservableTypeBadge type="sign" />
                <span className="text-sm text-gray-600">
                  Observation technicien
                </span>
              </div>
              <div className="flex items-center gap-2">
                <ObservableTypeBadge type="dtc" />
                <span className="text-sm text-gray-600">
                  Code diagnostic OBD
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Clusters */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Catégories de diagnostic
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClusters.map((cluster) => {
            const Icon = cluster.icon;
            return (
              <Link
                key={cluster.id}
                to={`/diagnostic-auto?cluster=${cluster.id}`}
                className="block"
              >
                <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-purple-500">
                  <CardHeader className="flex flex-row items-center gap-4">
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <Icon className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{cluster.label}</CardTitle>
                      <p className="text-sm text-gray-500">
                        {cluster.description}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400 ml-auto" />
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Diagnostics populaires */}
      {featured.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Diagnostics les plus consultés
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {featured.map((item) => {
              const PerceptionIcon =
                PERCEPTION_ICONS[item.perception_channel] || Volume2;
              return (
                <Link key={item.slug} to={`/diagnostic-auto/${item.slug}`}>
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-gray-100 rounded-lg">
                            <PerceptionIcon className="h-5 w-5 text-gray-600" />
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">
                              {item.title}
                            </h3>
                            <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                              {item.meta_description}
                            </p>
                            <div className="flex gap-2 mt-2">
                              <ObservableTypeBadge
                                type={item.observable_type}
                              />
                              <RiskBadge level={item.risk_level} />
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <Card className="bg-gradient-to-r from-gray-800 to-gray-900 text-white border-0">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-yellow-400" />
            <h3 className="text-xl font-bold mb-2">
              Vous avez un code erreur OBD ?
            </h3>
            <p className="text-gray-300 mb-4">
              Entrez votre code DTC (ex: P0300, C1234) pour un diagnostic précis
              à 95%
            </p>
            <div className="flex justify-center">
              <div className="relative max-w-xs w-full">
                <Input
                  type="text"
                  placeholder="P0300"
                  className="text-center font-mono text-lg"
                />
              </div>
            </div>
          </CardContent>
        </Card>
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
            Impossible de charger la page diagnostic. Veuillez réessayer.
          </p>
          <Link
            to="/"
            className="inline-flex items-center text-purple-600 hover:text-purple-700"
          >
            Retour à l'accueil
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
