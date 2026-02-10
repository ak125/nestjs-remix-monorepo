/**
 * Route : /diagnostic-auto
 * Index des pages Diagnostic (R5 - DIAGNOSTIC)
 *
 * Rôle SEO : R5 - DIAGNOSTIC
 * Intention : Identifier un symptôme automobile
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
  ArrowRight,
  Car,
  ChevronRight,
  Disc3,
  Eye,
  Gauge,
  ScanLine,
  Search,
  Shield,
  ThermometerSun,
  Volume2,
  Wrench,
  Zap,
  BookOpen,
} from "lucide-react";
import { useState } from "react";

import { Error404 } from "~/components/errors/Error404";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { PublicBreadcrumb } from "~/components/ui/PublicBreadcrumb";
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";

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
  color: string;
}

const CLUSTERS: ClusterInfo[] = [
  {
    id: "embrayage",
    label: "Embrayage",
    icon: Disc3,
    description: "Patinage, bruits, vibrations pédale",
    color: "from-amber-500 to-orange-600",
  },
  {
    id: "freinage",
    label: "Freinage",
    icon: Shield,
    description: "Sifflements, vibrations, efficacité réduite",
    color: "from-red-500 to-rose-600",
  },
  {
    id: "moteur",
    label: "Moteur",
    icon: Gauge,
    description: "Claquements, fumées, perte de puissance",
    color: "from-slate-600 to-slate-800",
  },
  {
    id: "suspension",
    label: "Suspension",
    icon: Car,
    description: "Cognements, tenue de route dégradée",
    color: "from-blue-500 to-indigo-600",
  },
  {
    id: "electricite",
    label: "Électricité",
    icon: Zap,
    description: "Voyants allumés, démarrage difficile",
    color: "from-yellow-500 to-amber-600",
  },
  {
    id: "refroidissement",
    label: "Refroidissement",
    icon: ThermometerSun,
    description: "Surchauffe, fuites liquide, ventilateur",
    color: "from-cyan-500 to-teal-600",
  },
];

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

const RISK_CONFIG = {
  critique: {
    label: "Critique",
    dot: "bg-red-500",
    text: "text-red-700",
    bg: "bg-red-50",
  },
  securite: {
    label: "Sécurité",
    dot: "bg-amber-500",
    text: "text-amber-700",
    bg: "bg-amber-50",
  },
  confort: {
    label: "Confort",
    dot: "bg-blue-500",
    text: "text-blue-700",
    bg: "bg-blue-50",
  },
} as const;

export const meta: MetaFunction = () => {
  const canonicalUrl = "https://www.automecanik.com/diagnostic-auto";
  return [
    { title: "Diagnostic Auto : Identifiez votre panne | AutoMekanik" },
    {
      name: "description",
      content:
        "Diagnostic automobile gratuit : identifiez bruits, vibrations, voyants. 193 diagnostics avec causes probables et solutions par nos experts.",
    },
    { name: "robots", content: "index, follow" },
    { tagName: "link", rel: "canonical", href: canonicalUrl },
    {
      property: "og:title",
      content: "Diagnostic Auto : Identifiez votre panne",
    },
    {
      property: "og:description",
      content:
        "Diagnostic automobile gratuit : identifiez bruits, vibrations, voyants. Causes probables et solutions par nos experts.",
    },
    { property: "og:type", content: "website" },
    { property: "og:url", content: canonicalUrl },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const API_URL = process.env.VITE_API_URL || "http://127.0.0.1:3000";

  try {
    const response = await fetch(`${API_URL}/api/seo/diagnostic/featured`, {
      headers: { Accept: "application/json" },
    });

    let featured: DiagnosticItem[] = [];
    if (response.ok) {
      const data = await response.json();
      featured = data?.data || [];
    }

    const faqSchema =
      featured.length > 0
        ? {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: featured.slice(0, 5).map((d) => ({
              "@type": "Question",
              name: `Qu'est-ce qu'un ${d.title.split(":")[0].trim()} ?`,
              acceptedAnswer: {
                "@type": "Answer",
                text:
                  d.meta_description ||
                  `Le ${d.title.split(":")[0].trim().toLowerCase()} est un symptôme automobile.`,
              },
            })),
          }
        : null;

    return json({ featured, faqSchema });
  } catch (error) {
    logger.error("[diagnostic-auto._index] Loader error:", error);
    return json({ featured: [], faqSchema: null });
  }
}

export default function DiagnosticAutoIndex() {
  const { featured, faqSchema } = useLoaderData<typeof loader>();
  const [searchQuery, setSearchQuery] = useState("");
  const [dtcCode, setDtcCode] = useState("");

  const filteredClusters = CLUSTERS.filter(
    (c) =>
      c.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
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

      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden bg-[#0d1b3e] text-white">
        {/* Grid pattern */}
        <div
          className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:3rem_3rem]"
          aria-hidden="true"
        />
        {/* Accent glow */}
        <div
          className="absolute -top-24 -right-24 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl"
          aria-hidden="true"
        />

        <div className="relative max-w-7xl mx-auto px-4 py-16 md:py-20">
          <div className="max-w-3xl">
            {/* Icon + badge */}
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-orange-500/20 rounded-xl border border-orange-500/30">
                <ScanLine className="h-7 w-7 text-orange-400" />
              </div>
              <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 hover:bg-orange-500/30">
                193 diagnostics disponibles
              </Badge>
            </div>

            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
              Identifiez votre{" "}
              <span className="bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
                panne auto
              </span>
            </h1>

            <p className="text-lg text-white/70 mb-8 max-w-xl leading-relaxed">
              Décrivez le symptôme, notre outil identifie les causes probables
              et vous oriente vers la bonne pièce. Gratuit, sans inscription.
            </p>

            {/* Search + OBD inline */}
            <div className="flex flex-col sm:flex-row gap-3 max-w-2xl">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="search"
                  placeholder="Décrivez votre problème (ex: bruit au freinage, vibration volant...)"
                  className="pl-11 h-12 bg-white text-gray-900 rounded-xl border-0 text-base"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const code = dtcCode.trim().toUpperCase();
                  if (code) {
                    window.location.href = `/diagnostic-auto?dtc=${encodeURIComponent(code)}`;
                  }
                }}
                className="flex gap-2"
              >
                <Input
                  type="text"
                  placeholder="Code OBD (P0300...)"
                  className="h-12 w-40 bg-white/10 border-white/20 text-white placeholder:text-white/40 font-mono rounded-xl text-center"
                  value={dtcCode}
                  onChange={(e) => setDtcCode(e.target.value)}
                />
                <button
                  type="submit"
                  className="h-12 px-5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors whitespace-nowrap"
                >
                  Scanner
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ CLUSTERS ═══ */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Par catégorie</h2>
        <p className="text-gray-500 mb-8">
          Sélectionnez la zone concernée pour affiner le diagnostic
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {filteredClusters.map((cluster) => {
            const Icon = cluster.icon;
            return (
              <Link
                key={cluster.id}
                to={`/diagnostic-auto?cluster=${cluster.id}`}
                className="group block"
              >
                <div
                  className={`relative rounded-2xl p-5 bg-gradient-to-br ${cluster.color} text-white overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}
                >
                  <div
                    className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-x-4 -translate-y-4"
                    aria-hidden="true"
                  />
                  <Icon className="h-8 w-8 mb-3 relative z-10" />
                  <p className="font-bold text-sm relative z-10">
                    {cluster.label}
                  </p>
                  <p className="text-[11px] text-white/70 mt-1 leading-tight relative z-10">
                    {cluster.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        {filteredClusters.length === 0 && searchQuery && (
          <p className="text-center text-gray-500 py-8">
            Aucune catégorie ne correspond à « {searchQuery} »
          </p>
        )}
      </section>

      {/* ═══ DIAGNOSTICS POPULAIRES ═══ */}
      <section className="bg-white border-y">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Diagnostics fréquents
              </h2>
              <p className="text-gray-500 mt-1">
                Les pannes les plus recherchées par nos utilisateurs
              </p>
            </div>
          </div>

          {featured.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featured.map((item) => {
                const PerceptionIcon =
                  PERCEPTION_ICONS[item.perception_channel] || Volume2;
                const risk =
                  RISK_CONFIG[item.risk_level as keyof typeof RISK_CONFIG] ||
                  RISK_CONFIG.confort;

                return (
                  <Link
                    key={item.slug}
                    to={`/diagnostic-auto/${item.slug}`}
                    className="group"
                  >
                    <div className="h-full rounded-xl border bg-white p-5 transition-all duration-200 hover:shadow-lg hover:border-gray-300 group-hover:-translate-y-0.5">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="p-2 bg-gray-100 rounded-lg shrink-0 group-hover:bg-orange-50 transition-colors">
                          <PerceptionIcon className="h-5 w-5 text-gray-500 group-hover:text-orange-600 transition-colors" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-gray-900 text-sm leading-tight group-hover:text-orange-700 transition-colors">
                            {item.title}
                          </h3>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-300 shrink-0 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
                      </div>
                      <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                        {item.meta_description}
                      </p>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${risk.bg} ${risk.text}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${risk.dot}`}
                          />
                          {risk.label}
                        </span>
                        <span className="text-xs text-gray-400 capitalize">
                          {item.cluster_id?.replace(/-/g, " ")}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center">
              <ScanLine className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="font-semibold text-gray-900 mb-1">
                Diagnostics en cours de préparation
              </p>
              <p className="text-sm text-gray-500">
                Explorez les catégories ci-dessus en attendant.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ═══ CTA BOTTOM ═══ */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="rounded-2xl bg-[#0d1b3e] text-white p-8 md:p-12 flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
              <span className="text-sm font-medium text-yellow-400 uppercase tracking-wider">
                Code erreur
              </span>
            </div>
            <h3 className="text-2xl font-bold mb-2">
              Votre tableau de bord affiche un voyant ?
            </h3>
            <p className="text-white/60">
              Entrez le code OBD (P0XXX, C1XXX...) pour un diagnostic précis à
              95% de fiabilité.
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const code = dtcCode.trim().toUpperCase();
              if (code) {
                window.location.href = `/diagnostic-auto?dtc=${encodeURIComponent(code)}`;
              }
            }}
            className="flex gap-2 shrink-0"
          >
            <Input
              type="text"
              placeholder="P0300"
              className="h-12 w-36 bg-white/10 border-white/20 text-white placeholder:text-white/40 font-mono text-center rounded-xl text-lg"
              value={dtcCode}
              onChange={(e) => setDtcCode(e.target.value)}
            />
            <button
              type="submit"
              className="h-12 px-6 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-colors flex items-center gap-2"
            >
              Scanner
              <ChevronRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </section>

      {/* Cross-link glossaire */}
      <div className="max-w-7xl mx-auto px-4 pb-12 flex items-center justify-center gap-2 text-sm text-gray-500">
        <BookOpen className="w-4 h-4 text-indigo-500" />
        <span>Comprendre les pièces mentionnées ?</span>
        <Link
          to="/reference-auto"
          className="text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
        >
          Consulter le glossaire
        </Link>
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
            className="inline-flex items-center text-orange-600 hover:text-orange-800"
          >
            Retour à l'accueil
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
