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
import { BookOpen, Search, FileText, ChevronRight } from "lucide-react";
import { useState, useMemo } from "react";

// UI Components
import { Badge } from "../components/ui/badge";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Error404 } from "~/components/errors/Error404";
import { getInternalApiUrl } from "~/utils/internal-api.server";

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
    // Open Graph
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
      console.error("Erreur API référence:", res.status);
      return json<LoaderData>({ references: [], total: 0 });
    }

    const data = await res.json();

    return json<LoaderData>({
      references: data.references || [],
      total: data.total || 0,
    });
  } catch (error) {
    console.error("Erreur chargement références:", error);
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

  // Filter references by search
  const filteredReferences = useMemo(() => {
    if (!searchQuery.trim()) return references;
    const query = searchQuery.toLowerCase();
    return references.filter(
      (ref) =>
        ref.title.toLowerCase().includes(query) ||
        ref.definition.toLowerCase().includes(query) ||
        ref.gamme.name?.toLowerCase().includes(query),
    );
  }, [references, searchQuery]);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      {/* Schema.org JSON-LD */}
      <SchemaJsonLd references={references} />

      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-16">
        <div className="container mx-auto px-4">
          {/* Breadcrumbs */}
          <nav className="text-sm mb-4 text-indigo-200">
            <ol className="flex items-center gap-2">
              <li>
                <Link to="/" className="hover:text-white transition-colors">
                  Accueil
                </Link>
              </li>
              <li>/</li>
              <li className="text-white font-medium">Référence Auto</li>
            </ol>
          </nav>

          <div className="max-w-3xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center">
                <BookOpen className="w-8 h-8 text-white" />
              </div>
              <Badge className="bg-white/20 text-white border-0 text-sm">
                {total} définitions
              </Badge>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Référence Auto
            </h1>
            <p className="text-xl text-indigo-100 leading-relaxed">
              Glossaire complet des pièces automobiles. Découvrez les
              définitions techniques, rôles mécaniques et compositions
              détaillées pour comprendre votre véhicule.
            </p>
          </div>
        </div>
      </header>

      {/* Search Section */}
      <section className="py-8 border-b bg-white sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="max-w-xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="search"
              placeholder="Rechercher une définition..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 py-6 text-lg border-2 border-gray-200 focus:border-indigo-500"
            />
          </div>
          {searchQuery && (
            <p className="text-center text-sm text-gray-500 mt-3">
              {filteredReferences.length} résultat(s) pour "{searchQuery}"
            </p>
          )}
        </div>
      </section>

      {/* References List */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          {filteredReferences.length === 0 ? (
            <div className="text-center py-16">
              <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-medium text-gray-600 mb-2">
                {searchQuery
                  ? "Aucune définition trouvée"
                  : "Aucune référence disponible"}
              </h2>
              <p className="text-gray-500">
                {searchQuery
                  ? "Essayez avec d'autres termes"
                  : "Les définitions seront bientôt disponibles"}
              </p>
            </div>
          ) : (
            <div className="space-y-12">
              {groupedReferences.map(([letter, refs]) => (
                <div key={letter}>
                  {/* Letter Header */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-2xl font-bold">
                      {letter}
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-r from-indigo-200 to-transparent" />
                    <span className="text-sm text-gray-500">
                      {refs.length} définition(s)
                    </span>
                  </div>

                  {/* References Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {refs.map((ref) => (
                      <Link
                        key={ref.slug}
                        to={`/reference-auto/${ref.slug}`}
                        className="group"
                      >
                        <Card className="h-full hover:shadow-lg hover:border-indigo-300 transition-all duration-200">
                          <CardContent className="p-5">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-200 transition-colors">
                                <FileText className="w-5 h-5 text-indigo-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-2 mb-1">
                                  {ref.title.replace(/ : Définition.*$/, "")}
                                </h3>
                                <p className="text-sm text-gray-500 line-clamp-2">
                                  {ref.definition.substring(0, 100)}...
                                </p>
                                {ref.gamme.name && (
                                  <Badge
                                    variant="outline"
                                    className="mt-2 text-xs bg-gray-50"
                                  >
                                    {ref.gamme.name}
                                  </Badge>
                                )}
                              </div>
                              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 transition-colors flex-shrink-0" />
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Besoin d'une pièce pour votre véhicule ?
          </h2>
          <p className="text-indigo-100 mb-8 max-w-2xl mx-auto">
            Consultez notre catalogue de pièces automobiles pour trouver les
            pièces compatibles avec votre véhicule.
          </p>
          <Link
            to="/pieces/catalogue"
            className="inline-flex items-center gap-2 bg-white text-indigo-600 px-8 py-4 rounded-xl font-semibold hover:bg-indigo-50 transition-colors"
          >
            Voir le catalogue
            <ChevronRight className="w-5 h-5" />
          </Link>
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
