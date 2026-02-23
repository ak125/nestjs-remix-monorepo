/**
 * Route : /reference-auto
 * Index des pages Référence (R4) - Glossaire des définitions techniques
 *
 * Rôle SEO : R4 - RÉFÉRENCE
 * Intention : Hub des définitions officielles / vérités mécaniques
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
import { BookOpen, Search, ChevronRight, ShoppingCart } from "lucide-react";
import { useState, useMemo, useCallback } from "react";

import { BlogPiecesAutoNavigation } from "~/components/blog/BlogPiecesAutoNavigation";
import { Error404 } from "~/components/errors/Error404";
import { PublicBreadcrumb } from "~/components/ui/PublicBreadcrumb";
import { getFamilyTheme } from "~/utils/family-theme";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { ScrollArea, ScrollBar } from "../components/ui/scroll-area";

// Types
interface ReferenceItem {
  slug: string;
  title: string;
  metaDescription: string | null;
  definition: string;
  gamme: {
    pgId: number | null;
    name: string | null;
    url: string | null;
  };
}

interface LoaderData {
  references: ReferenceItem[];
  total: number;
}

// Gamme color: delegue a la source unique getFamilyTheme()
function getGammeColor(gammeName: string | null) {
  const theme = getFamilyTheme(gammeName || "");
  return {
    bg: theme.bg,
    text: theme.fg,
    border: theme.borderAccent,
    dot: theme.accent,
  };
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/* ===========================
   Meta
=========================== */
export const meta: MetaFunction = () => {
  const canonicalUrl = "https://www.automecanik.com/reference-auto";

  return [
    {
      title: "Référence Auto - Glossaire des Pièces Automobiles | Automecanik",
    },
    {
      name: "description",
      content:
        "Découvrez notre glossaire complet des pièces automobiles. Définitions techniques, rôles mécaniques et compositions détaillées pour comprendre votre véhicule.",
    },
    { tagName: "link", rel: "canonical", href: canonicalUrl },
    { name: "robots", content: "index, follow" },
    {
      property: "og:title",
      content: "Référence Auto - Glossaire des Pièces Automobiles",
    },
    {
      property: "og:description",
      content:
        "Découvrez notre glossaire complet des pièces automobiles. Définitions techniques et explications détaillées.",
    },
    { property: "og:type", content: "website" },
    { property: "og:url", content: canonicalUrl },
    {
      property: "og:image",
      content: "https://www.automecanik.com/images/og/glossaire-reference.webp",
    },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { name: "twitter:card", content: "summary_large_image" },
    {
      name: "twitter:image",
      content: "https://www.automecanik.com/images/og/glossaire-reference.webp",
    },
  ];
};

/* ===========================
   Loader
=========================== */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const backendUrl = getInternalApiUrl("");

    const res = await fetch(`${backendUrl}/api/seo/reference`, {
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      logger.error("Erreur API référence:", res.status);
      return json<LoaderData>({ references: [], total: 0 });
    }

    const data = await res.json();

    return json<LoaderData>({
      references: data.references || [],
      total: data.total || 0,
    });
  } catch (error) {
    logger.error("Erreur chargement références:", error);
    return json<LoaderData>({ references: [], total: 0 });
  }
}

/* ===========================
   JSON-LD Schema
=========================== */
function SchemaJsonLd({ references }: { references: ReferenceItem[] }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: "Référence Auto - Glossaire des Pièces Automobiles",
    description:
      "Glossaire complet des pièces automobiles avec définitions techniques détaillées.",
    url: "https://automecanik.com/reference-auto",
    hasDefinedTerm: references.slice(0, 20).map((ref) => ({
      "@type": "DefinedTerm",
      name: ref.title.replace(/ : Définition.*$/, ""),
      url: `https://automecanik.com/reference-auto/${ref.slug}`,
    })),
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Accueil",
        item: "https://automecanik.com/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Référence Auto",
        item: "https://automecanik.com/reference-auto",
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </>
  );
}

/* ===========================
   Component
=========================== */
export default function ReferenceIndexPage() {
  const { references, total } = useLoaderData<typeof loader>();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeGamme, setActiveGamme] = useState<string | null>(null);

  // Extract unique gamme categories with counts
  const gammeCategories = useMemo(() => {
    const map = new Map<string, number>();
    references.forEach((ref) => {
      const name = ref.gamme.name || "Autre";
      map.set(name, (map.get(name) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, count }));
  }, [references]);

  // Filter by search + gamme (AND logic)
  const filteredReferences = useMemo(() => {
    let result = references;

    if (activeGamme) {
      result = result.filter(
        (ref) => (ref.gamme.name || "Autre") === activeGamme,
      );
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (ref) =>
          ref.title.toLowerCase().includes(query) ||
          ref.definition.toLowerCase().includes(query) ||
          ref.gamme.name?.toLowerCase().includes(query),
      );
    }

    return result;
  }, [references, searchQuery, activeGamme]);

  // Group by first letter
  const groupedReferences = useMemo(() => {
    const groups: Record<string, ReferenceItem[]> = {};
    filteredReferences.forEach((ref) => {
      const firstLetter = ref.title.charAt(0).toUpperCase();
      if (!groups[firstLetter]) {
        groups[firstLetter] = [];
      }
      groups[firstLetter].push(ref);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredReferences]);

  // Available letters for nav
  const availableLetters = useMemo(() => {
    return new Set(groupedReferences.map(([letter]) => letter));
  }, [groupedReferences]);

  const scrollToLetter = useCallback((letter: string) => {
    const element = document.getElementById(`letter-${letter}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50" data-page-role="R4">
      <BlogPiecesAutoNavigation />
      <SchemaJsonLd references={references} />

      {/* ═══ BREADCRUMB ═══ */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <PublicBreadcrumb items={[{ label: "Référence Auto" }]} />
        </div>
      </div>

      {/* ═══ HERO DARK PREMIUM ═══ */}
      <section className="relative overflow-hidden bg-[#0d1b3e] text-white">
        {/* Grid pattern */}
        <div
          className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:3rem_3rem]"
          aria-hidden="true"
        />
        {/* Accent glow */}
        <div
          className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-32 -left-32 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl"
          aria-hidden="true"
        />

        <div className="relative max-w-7xl mx-auto px-4 py-12 md:py-16">
          <div className="max-w-3xl">
            {/* Icon + badge */}
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
                <BookOpen className="h-7 w-7 text-indigo-400" />
              </div>
              <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/30">
                {total} définitions
              </Badge>
            </div>

            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">
              Encyclopédie{" "}
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Pièces Auto
              </span>
            </h1>

            <p className="text-lg text-white/70 mb-8 max-w-xl leading-relaxed">
              Glossaire complet des pièces automobiles. Définitions techniques,
              rôles mécaniques et compositions détaillées pour comprendre votre
              véhicule.
            </p>

            {/* Search bar */}
            <div className="max-w-xl">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="search"
                  placeholder="Rechercher une définition (ex: embrayage, plaquette...)"
                  className="pl-11 h-12 bg-white text-gray-900 rounded-xl border-0 text-base"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-3 mt-6">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-full text-sm text-white/80">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                {total} définitions
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-full text-sm text-white/80">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                {gammeCategories.length} catégories
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-full text-sm text-white/80">
                <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
                {availableLetters.size} lettres
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FILTRES GAMMES (STICKY) ═══ */}
      <section className="sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <ScrollArea className="w-full md:flex-1">
              <div className="flex gap-2 pb-1">
                {/* Chip "Toutes" */}
                <button
                  onClick={() => setActiveGamme(null)}
                  className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    activeGamme === null
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Toutes ({total})
                </button>
                {gammeCategories.map(({ name, count }) => {
                  const color = getGammeColor(name);
                  return (
                    <button
                      key={name}
                      onClick={() =>
                        setActiveGamme(activeGamme === name ? null : name)
                      }
                      className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        activeGamme === name
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${activeGamme === name ? "bg-white" : color.dot}`}
                      />
                      {name} ({count})
                    </button>
                  );
                })}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>

            {/* Filter status */}
            {(activeGamme || searchQuery) && (
              <p className="text-sm text-gray-500 shrink-0">
                {filteredReferences.length} résultat(s)
                {activeGamme && (
                  <button
                    onClick={() => {
                      setActiveGamme(null);
                      setSearchQuery("");
                    }}
                    className="ml-2 text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    Tout effacer
                  </button>
                )}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ═══ NAVIGATION ALPHABÉTIQUE ═══ */}
      <nav
        className="py-3 bg-gray-50 border-b"
        aria-label="Navigation alphabétique"
      >
        <div className="max-w-7xl mx-auto px-4">
          <ScrollArea className="w-full">
            <div className="flex items-center justify-center gap-1">
              {ALPHABET.map((letter) => {
                const hasEntries = availableLetters.has(letter);
                return (
                  <button
                    key={letter}
                    onClick={() => hasEntries && scrollToLetter(letter)}
                    disabled={!hasEntries}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-semibold transition-colors ${
                      hasEntries
                        ? "text-indigo-600 hover:bg-indigo-100 cursor-pointer"
                        : "text-gray-300 cursor-default"
                    }`}
                    aria-label={`Aller à la lettre ${letter}`}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      </nav>

      {/* ═══ GRILLE DE CARTES ═══ */}
      <section className="py-12 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
        <div className="max-w-7xl mx-auto px-4">
          {filteredReferences.length === 0 ? (
            <div className="text-center py-16">
              <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-medium text-gray-600 mb-2">
                {searchQuery || activeGamme
                  ? "Aucune définition trouvée"
                  : "Aucune référence disponible"}
              </h2>
              <p className="text-gray-500 mb-4">
                {searchQuery || activeGamme
                  ? "Essayez avec d'autres termes ou filtres"
                  : "Les définitions seront bientôt disponibles"}
              </p>
              {(searchQuery || activeGamme) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery("");
                    setActiveGamme(null);
                  }}
                >
                  Réinitialiser les filtres
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-12">
              {groupedReferences.map(([letter, refs]) => (
                <div
                  key={letter}
                  id={`letter-${letter}`}
                  className="scroll-mt-28"
                >
                  {/* Letter Header */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-[#0d1b3e] text-white flex items-center justify-center text-2xl font-bold">
                      {letter}
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-r from-indigo-200 to-transparent" />
                    <span className="text-sm text-gray-500">
                      {refs.length} définition(s)
                    </span>
                  </div>

                  {/* References Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {refs.map((ref) => {
                      const gammeColor = getGammeColor(ref.gamme.name);
                      return (
                        <Link
                          key={ref.slug}
                          to={`/reference-auto/${ref.slug}`}
                          className="group"
                        >
                          <Card
                            className={`h-full border-t-[3px] ${gammeColor.border} hover:shadow-lg hover:border-indigo-300 hover:-translate-y-0.5 transition-all duration-200`}
                          >
                            <CardContent className="p-5">
                              <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-2 mb-2">
                                {ref.title.replace(/ : Définition.*$/, "")}
                              </h3>
                              <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                                {ref.definition.substring(0, 120)}...
                              </p>
                              <div className="flex items-center justify-between">
                                {ref.gamme.name ? (
                                  <Badge
                                    variant="outline"
                                    className={`text-xs ${gammeColor.bg} ${gammeColor.text} border-0`}
                                  >
                                    {ref.gamme.name}
                                  </Badge>
                                ) : (
                                  <span />
                                )}
                                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ═══ CTA BOTTOM ═══ */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="bg-[#0d1b3e] rounded-2xl p-8 md:p-12 text-white relative overflow-hidden">
            {/* Pattern */}
            <div
              className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:3rem_3rem]"
              aria-hidden="true"
            />
            <div className="relative flex flex-col md:flex-row items-center gap-6 md:gap-8">
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-2xl md:text-3xl font-bold mb-3">
                  Besoin d'une pièce pour votre véhicule ?
                </h2>
                <p className="text-white/70 max-w-lg">
                  Consultez notre catalogue de plus de 500 000 pièces
                  automobiles pour trouver les pièces compatibles avec votre
                  véhicule.
                </p>
              </div>
              <Link to="/#catalogue">
                <Button
                  size="lg"
                  className="bg-indigo-500 hover:bg-indigo-600 text-white px-8 py-4 rounded-xl text-base font-semibold gap-2"
                >
                  <ShoppingCart className="w-5 h-5" />
                  Voir le catalogue
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ===========================
   Error Boundary
=========================== */
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <Error404 url={error.data?.url} />;
  }

  return <Error404 />;
}
