// app/routes/blog-pieces-auto.guide-achat._index.tsx
/**
 * Route : /blog-pieces-auto/guide-achat
 * Hub editorial des guides d'achat pieces auto
 *
 * Role SEO : R6 - GUIDE D'ACHAT
 * Architecture : Hub premium intention-focused
 * - Hero intention + trust bullets
 * - Start here (3 guides pratiques)
 * - Featured guide (le plus recent)
 * - Recherche locale + navigation familles
 * - Guides groupes par famille (via FAMILY_REGISTRY)
 * - Guides populaires (top qualite)
 * - Cross-link conseils
 * - Contenu editorial SEO
 */

import {
  json,
  type HeadersFunction,
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
  FAMILY_IDS_ORDERED,
  findFamilyIdByKeyword,
} from "@repo/database-types";
import {
  ArrowRight,
  BookOpen,
  Car,
  CheckCircle,
  ChevronDown,
  Clock,
  Eye,
  List,
  ScanLine,
  Search,
  Shield,
  Sparkles,
  Star,
  TriangleAlert,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { BlogPiecesAutoNavigation } from "~/components/blog/BlogPiecesAutoNavigation";
import { ErrorGeneric } from "~/components/errors/ErrorGeneric";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { ResponsiveImage } from "~/components/ui/ResponsiveImage";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";
import { stripHtmlForMeta } from "~/utils/seo-clean.utils";

/* ===========================
   Handle — PageRole SEO
=========================== */
export const handle = {
  pageRole: createPageRoleMeta(PageRole.R6_GUIDE_ACHAT, {
    clusterId: "guide-index",
    canonicalEntity: "guide-index",
  }),
};

/* ===========================
   Types
=========================== */
interface BlogGuide {
  id: string;
  type: string;
  title: string;
  slug: string;
  excerpt: string;
  publishedAt: string;
  viewsCount: number;
  featuredImage: string | null;
  h2Count?: number;
  h3Count?: number;
  readingTime?: number;
  keywords?: string[];
  tags?: string[];
  gammeSort?: number;
}

interface AdviceSummary {
  id: string;
  title: string;
  slug: string;
  pg_alias: string | null;
  excerpt: string;
  viewsCount: number;
  publishedAt: string;
}

interface LoaderData {
  guides: BlogGuide[];
  relatedAdvice: AdviceSummary[];
  totalAdvice: number;
}

/* ===========================
   Loader
=========================== */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const backendUrl = getInternalApiUrl("");

  const [guidesResult, adviceResult] = await Promise.allSettled([
    fetch(`${backendUrl}/api/blog/guides?limit=300&type=achat`, {
      headers: { "Content-Type": "application/json" },
    }),
    fetch(`${backendUrl}/api/blog/advice?limit=8&page=1`, {
      headers: { "Content-Type": "application/json" },
    }),
  ]);

  // Parse guides
  let guides: BlogGuide[] = [];
  try {
    if (guidesResult.status === "fulfilled" && guidesResult.value.ok) {
      const data = await guidesResult.value.json();
      if (data?.success && data.data?.guides) {
        guides = data.data.guides as BlogGuide[];
      }
    }
  } catch (e) {
    logger.error("Erreur parsing guides:", e);
  }

  // Parse advice
  let relatedAdvice: AdviceSummary[] = [];
  let totalAdvice = 0;
  try {
    if (adviceResult.status === "fulfilled" && adviceResult.value.ok) {
      const data = await adviceResult.value.json();
      if (data?.success && data.data?.articles) {
        relatedAdvice = (data.data.articles as AdviceSummary[]).slice(0, 8);
        totalAdvice = data.data.total ?? relatedAdvice.length;
      }
    }
  } catch (e) {
    logger.error("Erreur parsing advice:", e);
  }

  // Tri par date la plus recente en premier
  guides.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  // Pas de troncature : hub SEO doit afficher tous les guides pour le crawl

  logger.log(
    `Guides: ${guides.length}, Conseils: ${relatedAdvice.length}/${totalAdvice}`,
  );

  return json<LoaderData>(
    { guides, relatedAdvice, totalAdvice },
    {
      headers: {
        "Cache-Control":
          "public, max-age=60, s-maxage=600, stale-while-revalidate=86400",
      },
    },
  );
};

// Cache — 1min browser + 10min CDN (listing stable)
export const headers: HeadersFunction = () => ({
  "Cache-Control":
    "public, max-age=60, s-maxage=600, stale-while-revalidate=86400",
});

/* ===========================
   Meta + Structured Data
=========================== */
export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const count = data?.guides?.length ?? 0;
  const canonicalUrl =
    "https://www.automecanik.com/blog-pieces-auto/guide-achat";

  const description =
    "Guides d'achat pieces auto : choisir une piece compatible (VIN/immat), comparer marques et prix, eviter les erreurs. Mis a jour 2026.";

  // CollectionPage + ItemList + BreadcrumbList
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": canonicalUrl,
        name: "Guides d'Achat Pieces Auto",
        description,
        url: canonicalUrl,
        mainEntity: { "@id": `${canonicalUrl}#list` },
        breadcrumb: { "@id": `${canonicalUrl}#breadcrumb` },
        about: [
          { "@type": "Thing", name: "Pieces auto" },
          { "@type": "Thing", name: "Guide d'achat" },
          { "@type": "Thing", name: "Compatibilite vehicule" },
          { "@type": "Thing", name: "OEM et equipementier" },
        ],
        publisher: {
          "@type": "Organization",
          name: "Automecanik",
          url: "https://www.automecanik.com",
        },
      },
      {
        "@type": "ItemList",
        "@id": `${canonicalUrl}#list`,
        name: "Guides d'Achat Pieces Auto",
        numberOfItems: count,
        itemListElement: (data?.guides || []).map((guide, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: guide.title.replace(/^Guide achat de piece auto:?\s*/i, ""),
          url: `${canonicalUrl}/${guide.slug}`,
        })),
      },
      {
        "@type": "FAQPage",
        "@id": `${canonicalUrl}#faq`,
        mainEntity: [
          {
            "@type": "Question",
            name: "Comment etre sur qu'une piece est compatible avec mon vehicule ?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Utilisez votre numero d'immatriculation ou votre code VIN (17 caracteres, sur la carte grise). Ces identifiants permettent de filtrer les pieces exactement compatibles avec votre motorisation, annee-modele et variante.",
            },
          },
          {
            "@type": "Question",
            name: "Quelle difference entre OEM, equipementier et adaptable ?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "OEM (origine) : piece identique a celle montee en usine. Equipementier (Bosch, Valeo, TRW...) : meme qualite de fabrication, souvent moins chere. Adaptable : entree de gamme, convient pour un usage leger.",
            },
          },
          {
            "@type": "Question",
            name: "Comment lire une reference OEM et l'utiliser pour commander ?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "La reference OEM est un code alphanumerique grave sur la piece ou indique dans le carnet d'entretien. Saisissez-la dans la barre de recherche pour retrouver la piece exacte ou ses equivalences.",
            },
          },
          {
            "@type": "Question",
            name: "Pourquoi un meme modele a plusieurs pieces differentes ?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Deux vehicules du meme modele peuvent avoir des motorisations, annees de fabrication ou options differentes. Chaque variante peut necessiter des dimensions, connectiques ou puissances specifiques.",
            },
          },
          {
            "@type": "Question",
            name: "Faut-il privilegier une marque precise ?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Les grandes marques equipementieres (Bosch, Valeo, TRW, SKF, LuK, Gates, Mann-Filter) offrent un excellent rapport qualite/prix. Elles fabriquent souvent les pieces d'origine pour les constructeurs.",
            },
          },
          {
            "@type": "Question",
            name: "Quand faut-il demander un diagnostic plutot que d'acheter ?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Si vous n'etes pas sur de la piece defaillante (bruit, vibration, voyant), un diagnostic est preferable. Acheter a l'aveugle risque de couter deux fois.",
            },
          },
        ],
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Accueil",
            item: "https://www.automecanik.com",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Blog Pieces Auto",
            item: "https://www.automecanik.com/blog-pieces-auto",
          },
          {
            "@type": "ListItem",
            position: 3,
            name: "Guides d'Achat",
          },
        ],
      },
    ],
  };

  return [
    {
      title: `Guides d'Achat Pieces Auto${count > 0 ? ` (${count})` : ""} - Comparatifs & Conseils | Automecanik`,
    },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: canonicalUrl },
    { name: "robots", content: "index, follow" },
    { property: "og:title", content: "Guides d'Achat Pieces Auto" },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: canonicalUrl },
    {
      property: "og:image",
      content: "https://www.automecanik.com/images/og/guide-achat.webp",
    },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { name: "twitter:card", content: "summary_large_image" },
    {
      name: "twitter:title",
      content: "Guides d'Achat Pieces Auto",
    },
    { name: "twitter:description", content: description },
    {
      name: "twitter:image",
      content: "https://www.automecanik.com/images/og/guide-achat.webp",
    },
    { "script:ld+json": schema },
  ];
};

/* ===========================
   Helpers
=========================== */
const formatViews = (views: number) => {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}k`;
  return views.toString();
};

const cleanGuideTitle = (title: string) =>
  title.replace(/^Guide achat de piece auto:?\s*/i, "");

/** Score qualite — penalise les templates vides (h2<3 ou readingTime<5 = 0) */
const qualityScore = (g: BlogGuide) => {
  const h2 = g.h2Count || 0;
  const rt = g.readingTime || 0;
  if (h2 < 3 || rt < 5) return 0;
  return h2 * 2 + rt;
};

/**
 * Résout un tag DB vers un mf_id via findFamilyIdByKeyword.
 * Retourne le tag original (affiché tel quel) + le mf_id pour le tri.
 */
const UNCATEGORIZED = "Toutes les pieces";

/** Extrait la famille d'un guide depuis ses tags (robuste via keywords registre) */
const getFamily = (g: BlogGuide): string => {
  for (const tag of g.tags ?? []) {
    if (findFamilyIdByKeyword(tag) != null) return tag;
  }
  return UNCATEGORIZED;
};

/** Retourne le mf_id d'un nom de famille (tag DB) pour le tri */
const getFamilySortIndex = (familyTag: string): number => {
  const mfId = findFamilyIdByKeyword(familyTag);
  if (mfId == null) return FAMILY_IDS_ORDERED.length;
  const idx = FAMILY_IDS_ORDERED.indexOf(mfId as number);
  return idx === -1 ? FAMILY_IDS_ORDERED.length : idx;
};

/** Detecte un guide "outil" (transversal, pas lie a une famille produit) */
const isToolGuide = (g: BlogGuide): boolean =>
  (g.tags ?? []).includes("Outils");

/** Genere un slug d'ancre pour une famille */
const familyAnchor = (family: string) =>
  `famille-${family
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+$/, "")}`;

/** Icones SVG par famille keyed par mf_id */
const FAMILY_ICON_BY_ID: Record<number, string> = {
  1: "/images/categories/Filtres.svg",
  2: "/images/categories/Freinage.svg",
};
const DEFAULT_FAMILY_ICON = "/images/categories/default.svg";

/** Image de couverture par famille keyed par mf_id */
const FAMILY_COVER_BY_ID: Record<number, string> = {
  1: "/images/og/guide-achat.webp", // Filtration
  2: "/images/og/guide-achat.webp", // Freinage
  3: "/images/og/outil.webp", // Distribution
  4: "/images/og/guide-achat.webp", // Allumage
  5: "/images/og/diagnostic.webp", // Direction
  6: "/images/og/diagnostic.webp", // Amortisseur
  7: "/images/og/guide-achat.webp", // Support moteur
  8: "/images/og/glossaire-reference.webp", // Embrayage
  9: "/images/og/guide-achat.webp", // Transmission
  10: "/images/og/guide-achat.webp", // Electrique
  11: "/images/og/guide-achat.webp", // Alimentation
  12: "/images/og/guide-achat.webp", // Capteurs
  13: "/images/og/guide-achat.webp", // Moteur
  14: "/images/og/guide-achat.webp", // Refroidissement
  15: "/images/og/guide-achat.webp", // Climatisation
  16: "/images/og/panne-symptome.webp", // Echappement
  17: "/images/og/selection.webp", // Eclairage
  18: "/images/og/transaction.webp", // Accessoires
  19: "/images/og/blog-conseil.webp", // Turbo
  20: "/images/og/guide-achat.webp", // Pièces équipementier
};
const DEFAULT_FAMILY_COVER = "/images/og/guide-achat.webp";

/** Résout un tag famille vers son icône */
const getFamilyIconByTag = (tag: string): string => {
  const mfId = findFamilyIdByKeyword(tag);
  return mfId != null
    ? (FAMILY_ICON_BY_ID[mfId as number] ?? DEFAULT_FAMILY_ICON)
    : DEFAULT_FAMILY_ICON;
};

/** Résout un tag famille vers son image de couverture */
const getFamilyCoverByTag = (tag: string): string => {
  const mfId = findFamilyIdByKeyword(tag);
  return mfId != null
    ? (FAMILY_COVER_BY_ID[mfId as number] ?? DEFAULT_FAMILY_COVER)
    : DEFAULT_FAMILY_COVER;
};

/** Nombre max de guides affichés par famille avant "Afficher plus" */
const FAMILY_PREVIEW_COUNT = 8;

/** Cap pour "Toutes les pieces" (non-expanded) */
const AUTRES_PREVIEW_COUNT = 24;

/* ===========================
   Guides épinglés (routes statiques hors DB)
=========================== */
const PINNED_GUIDES: BlogGuide[] = [
  {
    id: "pinned-selecteur-vehicule",
    type: "achat",
    title: "Selecteur de vehicule pieces auto : comment trouver la bonne piece",
    slug: "comment-utiliser-selecteur-vehicule-pieces-auto",
    excerpt:
      "4 methodes pour identifier votre vehicule et trouver les pieces compatibles : immatriculation, code VIN, selection manuelle ou reference OEM.",
    publishedAt: "2026-02-01T00:00:00Z",
    viewsCount: 0,
    featuredImage: null,
    h2Count: 8,
    readingTime: 12,
    keywords: [
      "selecteur vehicule",
      "trouver piece auto",
      "immatriculation",
      "code VIN",
    ],
    tags: ["Outils", "Selecteur vehicule"],
  },
];

/* "Start here" — slugs des guides essentiels pour debutants */
const START_HERE = [
  {
    slug: "comment-utiliser-selecteur-vehicule-pieces-auto",
    fallbackTitle: "Comment trouver la bonne piece (immat/VIN)",
    fallbackExcerpt:
      "Utilisez votre immatriculation ou code VIN pour identifier les pieces compatibles avec votre vehicule.",
    icon: Car,
    color: "from-green-500 to-emerald-600",
  },
  {
    slug: "_oem-vs-equipementier",
    fallbackTitle: "OEM vs equipementier : que choisir ?",
    fallbackExcerpt:
      "Comprendre les differences entre pieces d'origine (OEM), equipementier et adaptable pour faire le bon choix.",
    icon: Shield,
    color: "from-blue-500 to-indigo-600",
  },
  {
    slug: "_erreurs-achat",
    fallbackTitle: "5 erreurs a eviter lors de l'achat",
    fallbackExcerpt:
      "Les pieges courants : mauvaise compatibilite, prix trop bas, absence de garantie...",
    icon: CheckCircle,
    color: "from-amber-500 to-orange-600",
  },
];

/* ===========================
   FAQ data (visible + schema)
=========================== */
const FAQ_ITEMS = [
  {
    q: "Comment etre sur qu'une piece est compatible avec mon vehicule ?",
    a: "Utilisez votre numero d'immatriculation ou votre code VIN (17 caracteres, sur la carte grise). Ces identifiants permettent de filtrer les pieces exactement compatibles avec votre motorisation, annee-modele et variante. En cas de doute, comparez la reference OEM inscrite sur la piece d'origine.",
  },
  {
    q: "Quelle difference entre OEM, equipementier et adaptable ?",
    a: "OEM (origine) : piece identique a celle montee en usine. Equipementier (Bosch, Valeo, TRW...) : meme qualite de fabrication, souvent moins chere. Adaptable : entree de gamme, convient pour un usage leger si la compatibilite est parfaite.",
  },
  {
    q: "Comment lire une reference OEM et l'utiliser pour commander ?",
    a: "La reference OEM est un code alphanumerique grave sur la piece ou indique dans le carnet d'entretien. Saisissez-la dans la barre de recherche pour retrouver la piece exacte ou ses equivalences equipementieres.",
  },
  {
    q: "Pourquoi un meme modele a plusieurs pieces differentes ?",
    a: "Deux vehicules du meme modele peuvent avoir des motorisations, des annees de fabrication ou des options differentes. Chaque variante peut necessiter des dimensions, connectiques ou puissances specifiques.",
  },
  {
    q: "Quelle piece choisir si je roule beaucoup (autoroute / taxi / livraison) ?",
    a: "Privilegiez les pieces equipementier ou renforcees. Pour le freinage, choisissez des disques ventiles et des plaquettes haute performance. Pour la filtration, un filtre de qualite superieure prolonge la duree de vie du moteur.",
  },
  {
    q: "Faut-il privilegier une marque precise ?",
    a: "Les grandes marques equipementieres (Bosch, Valeo, TRW, SKF, LuK, Gates, Mann-Filter) offrent un excellent rapport qualite/prix. Elles fabriquent souvent les pieces d'origine pour les constructeurs.",
  },
  {
    q: "Comment eviter les retours et les erreurs de commande ?",
    a: "Verifiez systematiquement la compatibilite via VIN ou immatriculation. Comparez la reference OEM. Consultez les photos et dimensions. En cas de doute, contactez le support avant de commander.",
  },
  {
    q: "Quand faut-il demander un diagnostic plutot que d'acheter ?",
    a: "Si vous n'etes pas sur de la piece defaillante (bruit, vibration, voyant), un diagnostic est preferable. Acheter \"a l'aveugle\" risque de vous couter deux fois : la piece inutile + la bonne piece ensuite.",
  },
  {
    q: 'Puis-je monter une piece "performance" sur un vehicule standard ?',
    a: "Dans la plupart des cas oui, a condition que les dimensions et fixations soient identiques. Une piece renforcee (disques perces, plaquettes sport) ameliore la performance sans modifier le vehicule.",
  },
  {
    q: "Que verifier si la piece recue ne ressemble pas a l'ancienne ?",
    a: "Comparez la reference OEM, les dimensions, le nombre de trous de fixation et les connecteurs. Les pieces evoluent visuellement entre generations, mais les cotes fonctionnelles doivent correspondre.",
  },
];

/** FAQ component with expand/collapse */
function FaqSection() {
  const [showAll, setShowAll] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const visible = showAll ? FAQ_ITEMS : FAQ_ITEMS.slice(0, 6);

  return (
    <section className="py-12 bg-slate-50">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Questions frequentes sur les guides d'achat pieces auto
          </h2>

          <div className="space-y-3">
            {visible.map((item, idx) => (
              <div
                key={idx}
                className="bg-white border border-gray-200 rounded-lg overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-medium text-gray-900 pr-4 text-sm">
                    {item.q}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${openIndex === idx ? "rotate-180" : ""}`}
                  />
                </button>
                {openIndex === idx && (
                  <div className="px-4 pb-4 text-sm text-gray-600 leading-relaxed">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>

          {!showAll && FAQ_ITEMS.length > 6 && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:border-green-400 hover:text-green-600 hover:bg-green-50 transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
                Voir {FAQ_ITEMS.length - 6} autres questions
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ===========================
   Page
=========================== */
export default function BlogGuidesIndex() {
  const { guides, relatedAdvice, totalAdvice } = useLoaderData<typeof loader>();

  // Fusionner pinned + API, dedup par slug, tri par qualite desc
  const allGuides = useMemo(() => {
    const map = new Map<string, BlogGuide>();
    for (const g of PINNED_GUIDES) map.set(g.slug, g);
    for (const g of guides) map.set(g.slug, g); // API ecrase si existe
    return Array.from(map.values()).sort(
      (a, b) => qualityScore(b) - qualityScore(a),
    );
  }, [guides]);

  const featuredGuide = allGuides[0] ?? null;
  const otherGuides = allGuides.slice(1);

  // Recherche locale (filtre instantané front-only)
  const [searchQuery, setSearchQuery] = useState("");
  const isSearching = searchQuery.trim().length > 0;

  const filteredGuides = useMemo(() => {
    if (!isSearching) return otherGuides;
    const q = searchQuery.toLowerCase();
    return otherGuides.filter(
      (g) =>
        g.title.toLowerCase().includes(q) ||
        g.excerpt.toLowerCase().includes(q) ||
        (g.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  }, [otherGuides, searchQuery, isSearching]);

  // Séparer guides produit (familles) et guides outils (transversaux)
  const toolGuides = filteredGuides.filter(isToolGuide);
  const productGuides = filteredGuides.filter((g) => !isToolGuide(g));

  // Groupement par famille (via findFamilyIdByKeyword)
  const groupedGuides = useMemo(() => {
    const groups: Record<string, BlogGuide[]> = {};
    productGuides.forEach((guide) => {
      const family = getFamily(guide);
      if (!groups[family]) groups[family] = [];
      groups[family].push(guide);
    });
    // Trier chaque famille par ordre catalogue (gammeSort), puis qualité
    for (const familyGuides of Object.values(groups)) {
      familyGuides.sort((a, b) => {
        const sortA = a.gammeSort ?? 999;
        const sortB = b.gammeSort ?? 999;
        if (sortA !== sortB) return sortA - sortB;
        return qualityScore(b) - qualityScore(a);
      });
    }
    return Object.entries(groups).sort(([famA], [famB]) => {
      if (famA === UNCATEGORIZED) return 1;
      if (famB === UNCATEGORIZED) return -1;
      const posA = getFamilySortIndex(famA);
      const posB = getFamilySortIndex(famB);
      if (posA !== posB) return posA - posB;
      return famA.localeCompare(famB);
    });
  }, [productGuides]);

  // Top 6 guides par score qualite (pour section "Les plus complets")
  const topQualityGuides = useMemo(() => {
    return [...otherGuides]
      .sort((a, b) => qualityScore(b) - qualityScore(a))
      .slice(0, 6);
  }, [otherGuides]);

  // State pour "Afficher plus" par famille
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(
    () => new Set(),
  );

  const toggleFamily = (family: string) => {
    setExpandedFamilies((prev) => {
      const next = new Set(prev);
      if (next.has(family)) {
        next.delete(family);
      } else {
        next.add(family);
      }
      return next;
    });
  };

  // Map slug → guide pour "Start here"
  const guideBySlug = useMemo(() => {
    const map = new Map<string, BlogGuide>();
    for (const g of allGuides) map.set(g.slug, g);
    return map;
  }, [allGuides]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-green-50">
      <BlogPiecesAutoNavigation />

      {/* ========== HERO INTENTION ========== */}
      <section className="relative py-12 md:py-16 bg-gradient-to-br from-green-600 via-emerald-600 to-green-700 text-white overflow-hidden">
        {/* Hero background image */}
        <div className="absolute inset-0 opacity-[0.15]">
          <img
            src="/images/og/guide-achat.webp"
            alt=""
            className="w-full h-full object-cover"
            loading="eager"
          />
        </div>
        {/* Gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-green-700/40 to-emerald-800/60" />

        <div className="container mx-auto px-4 relative">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 leading-tight">
              Guides d'achat pieces auto
            </h1>
            <p className="text-base md:text-lg text-green-100 mb-8 max-w-3xl mx-auto leading-relaxed">
              Choisir la bonne piece auto avant d'acheter, c'est eviter les
              erreurs de compatibilite, les retours inutiles et les mauvaises
              surprises au montage. Dans nos guides d'achat, vous apprenez a
              identifier la reference compatible (immatriculation, VIN,
              dimensions, motorisation), comparer qualite OEM / equipementier /
              adaptable, et choisir le bon niveau de performance selon votre
              budget. Chaque guide vous donne une methode simple, des criteres
              techniques a verifier, les marques recommandees selon les cas, et
              les erreurs frequentes a eviter.
            </p>

            {/* 2 CTAs */}
            <div className="flex items-center justify-center gap-4 flex-wrap mb-10">
              <Button
                asChild
                size="lg"
                className="bg-white text-green-700 hover:bg-green-50 font-semibold px-6 shadow-lg"
              >
                <Link to="/blog-pieces-auto/guide-achat/comment-utiliser-selecteur-vehicule-pieces-auto">
                  <Car className="w-4 h-4 mr-2" />
                  Trouver une piece compatible
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-2 border-white/80 text-white hover:bg-white/10 font-semibold px-6"
              >
                <a href="#familles">
                  <BookOpen className="w-4 h-4 mr-2" />
                  Parcourir par famille
                </a>
              </Button>
            </div>

            {/* 3 trust bullets */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-green-100">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-300" />
                <span>
                  Verifier la compatibilite (VIN/immat, moteur, dimensions)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-300" />
                <span>Comparer qualite, marques, prix et duree de vie</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-green-300" />
                <span>Acheter la bonne reference des la premiere commande</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== START HERE ========== */}
      <section
        id="start-here"
        className="py-8 bg-white border-b border-gray-100"
      >
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-green-600" />
              Par ou commencer ?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {START_HERE.map((item) => {
                const guide = guideBySlug.get(item.slug);
                const title = guide
                  ? cleanGuideTitle(guide.title)
                  : item.fallbackTitle;
                const excerpt = guide
                  ? stripHtmlForMeta(guide.excerpt)
                  : item.fallbackExcerpt;
                const href = guide
                  ? `/blog-pieces-auto/guide-achat/${guide.slug}`
                  : "/blog-pieces-auto/conseils";
                const Icon = item.icon;

                return (
                  <Link key={item.slug} to={href} className="group block">
                    <Card className="h-full border border-gray-100 hover:border-green-300 hover:shadow-lg transition-all group-hover:-translate-y-0.5">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-10 h-10 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center flex-shrink-0`}
                          >
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 text-sm mb-1 group-hover:text-green-600 transition-colors leading-tight">
                              {title}
                            </p>
                            <p className="text-xs text-gray-500 line-clamp-2">
                              {excerpt}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ========== CHOISIR PAR BESOIN ========== */}
      <section className="py-8 bg-slate-50 border-b border-gray-100">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Choisir par besoin
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  href: "#start-here",
                  icon: ScanLine,
                  label: "Compatibilite vehicule",
                  sub: "VIN, immatriculation, reference",
                  img: "/images/og/selection.webp",
                  color: "from-green-600/80 to-emerald-700/80",
                },
                {
                  href: "#methode",
                  icon: Shield,
                  label: "OEM vs equipementier",
                  sub: "Qualite, marques, garanties",
                  img: "/images/og/glossaire-reference.webp",
                  color: "from-blue-600/80 to-indigo-700/80",
                },
                {
                  href: "#methode",
                  icon: Wallet,
                  label: "Budget et qualite/prix",
                  sub: "Comparer sans se tromper",
                  img: "/images/og/transaction.webp",
                  color: "from-amber-600/80 to-yellow-700/80",
                },
                {
                  href: "#etape-5",
                  icon: TriangleAlert,
                  label: "Erreurs a eviter",
                  sub: "Pieges courants, retours",
                  img: "/images/og/diagnostic.webp",
                  color: "from-red-600/80 to-rose-700/80",
                },
              ].map((tile) => (
                <a
                  key={tile.href + tile.label}
                  href={tile.href}
                  className="group"
                >
                  <Card className="h-full overflow-hidden border border-gray-100 hover:border-green-300 hover:shadow-lg transition-all group-hover:-translate-y-0.5">
                    <div className="relative h-24 overflow-hidden">
                      <img
                        src={tile.img}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      <div
                        className={`absolute inset-0 bg-gradient-to-br ${tile.color}`}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <tile.icon className="w-8 h-8 text-white drop-shadow-md" />
                      </div>
                    </div>
                    <CardContent className="p-3 text-center">
                      <p className="font-semibold text-sm text-gray-900 group-hover:text-green-600 transition-colors">
                        {tile.label}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{tile.sub}</p>
                    </CardContent>
                  </Card>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ========== FEATURED GUIDE (le plus recent) ========== */}
      {featuredGuide && (
        <section className="py-12">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto">
              <Link
                to={`/blog-pieces-auto/guide-achat/${featuredGuide.slug}`}
                prefetch="intent"
                className="group block"
              >
                <Card className="overflow-hidden border-2 border-gray-100 hover:border-green-300 hover:shadow-2xl hover:shadow-green-100/50 transition-all duration-300 group-hover:-translate-y-1">
                  <div className="flex flex-col md:flex-row">
                    {/* Image */}
                    <div className="relative md:w-80 h-48 md:h-auto flex-shrink-0 overflow-hidden">
                      {featuredGuide.featuredImage ? (
                        <ResponsiveImage
                          src={featuredGuide.featuredImage}
                          alt={cleanGuideTitle(featuredGuide.title)}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="eager"
                          showPlaceholder
                          fallback="/images/pieces/default.png"
                          widths={[320, 480, 640]}
                          sizes="(max-width: 768px) 100vw, 320px"
                        />
                      ) : (
                        <div className="w-full h-full min-h-[200px] relative">
                          <img
                            src={getFamilyCoverByTag(getFamily(featuredGuide))}
                            alt={cleanGuideTitle(featuredGuide.title)}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            loading="eager"
                          />
                          <div className="absolute inset-0 bg-gradient-to-br from-green-600/30 to-emerald-600/30" />
                        </div>
                      )}
                      <Badge className="absolute top-3 left-3 bg-success text-white border-0 shadow-lg">
                        <Sparkles className="w-3 h-3 mr-1" />
                        Guide le plus complet
                      </Badge>
                    </div>

                    {/* Content */}
                    <CardContent className="flex-1 p-6 md:p-8 flex flex-col justify-center">
                      <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 group-hover:text-green-600 transition-colors leading-tight">
                        {cleanGuideTitle(featuredGuide.title)}
                      </h2>

                      <p className="text-gray-600 mb-5 line-clamp-3 leading-relaxed">
                        {stripHtmlForMeta(featuredGuide.excerpt)}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-5">
                        {featuredGuide.h2Count != null &&
                          featuredGuide.h2Count > 0 && (
                            <div className="flex items-center gap-1.5">
                              <List className="w-4 h-4 text-green-600" />
                              <span>{featuredGuide.h2Count} sections</span>
                            </div>
                          )}
                        {featuredGuide.viewsCount != null &&
                          featuredGuide.viewsCount > 0 && (
                            <div className="flex items-center gap-1.5">
                              <Eye className="w-4 h-4 text-green-600" />
                              <span>
                                {formatViews(featuredGuide.viewsCount)} vues
                              </span>
                            </div>
                          )}
                        {featuredGuide.readingTime != null &&
                          featuredGuide.readingTime > 0 && (
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-4 h-4 text-green-600" />
                              <span>{featuredGuide.readingTime} min</span>
                            </div>
                          )}
                      </div>

                      <div>
                        <span className="inline-flex items-center rounded-md px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-green-600 to-emerald-600 group-hover:from-green-700 group-hover:to-emerald-700 transition-colors">
                          Lire le guide
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </span>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ========== GUIDES PRATIQUES (outils transversaux) ========== */}
      {toolGuides.length > 0 && (
        <section className="py-8 bg-gradient-to-r from-blue-50 to-indigo-50 border-y border-blue-100">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-blue-600" />
                Guides pratiques
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {toolGuides.map((guide) => (
                  <Link
                    key={guide.id}
                    to={`/blog-pieces-auto/guide-achat/${guide.slug}`}
                    prefetch="intent"
                    className="group block"
                  >
                    <Card className="h-full hover:shadow-xl hover:shadow-blue-100/50 transition-all duration-300 border border-blue-200 hover:border-blue-400 group-hover:-translate-y-0.5 bg-white overflow-hidden">
                      <div className="flex flex-row h-full">
                        <div className="relative w-28 flex-shrink-0 overflow-hidden">
                          <img
                            src="/images/og/outil.webp"
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/40 to-indigo-700/30" />
                          <Wrench className="absolute bottom-2 right-2 w-5 h-5 text-white/80" />
                        </div>
                        <CardContent className="flex-1 p-4">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-gray-900 mb-1.5 group-hover:text-blue-600 transition-colors leading-tight">
                              {cleanGuideTitle(guide.title)}
                            </h4>
                            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                              {stripHtmlForMeta(guide.excerpt)}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              {guide.h2Count != null && guide.h2Count > 0 && (
                                <div className="flex items-center gap-1">
                                  <List className="w-3.5 h-3.5" />
                                  <span>{guide.h2Count} sections</span>
                                </div>
                              )}
                              {guide.readingTime != null &&
                                guide.readingTime > 0 && (
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>{guide.readingTime} min</span>
                                  </div>
                                )}
                            </div>
                          </div>
                        </CardContent>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========== RECHERCHE + NAVIGATION FAMILLES ========== */}
      <section
        id="familles"
        className="py-6 bg-white border-b border-gray-100 sticky top-0 z-10 md:static md:z-auto"
      >
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            {/* Search bar */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <Input
                type="text"
                placeholder="Rechercher un guide... (ex: disque, plaquette, ampoule)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10"
              />
              {isSearching && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Resultats recherche */}
            {isSearching && (
              <p className="text-sm text-gray-500 mb-4">
                {filteredGuides.length} guide
                {filteredGuides.length !== 1 ? "s" : ""} trouve
                {filteredGuides.length !== 1 ? "s" : ""} pour &laquo;{" "}
                {searchQuery} &raquo;
              </p>
            )}

            {/* Chips familles (masquées pendant la recherche) */}
            {!isSearching && groupedGuides.length > 1 && (
              <>
                <p className="text-sm font-medium text-gray-500 mb-3">
                  Parcourir par famille
                </p>
                <div className="flex flex-wrap gap-2">
                  {groupedGuides.map(([family, familyGuides]) => (
                    <a
                      key={family}
                      href={`#${familyAnchor(family)}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-white border border-gray-200 hover:border-green-400 hover:bg-green-50 transition-colors"
                    >
                      <img
                        src={getFamilyIconByTag(family)}
                        alt=""
                        className="w-4 h-4"
                        loading="lazy"
                      />
                      {family}{" "}
                      <span className="text-gray-400">
                        ({familyGuides.length})
                      </span>
                    </a>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ========== GUIDES PAR FAMILLE ========== */}
      {groupedGuides.map(([family, familyGuides], famIdx) => {
        const isExpanded = expandedFamilies.has(family);
        const previewCount =
          family === UNCATEGORIZED
            ? AUTRES_PREVIEW_COUNT
            : FAMILY_PREVIEW_COUNT;
        const hasMore = familyGuides.length > previewCount;
        const visibleGuides =
          isExpanded || !hasMore
            ? familyGuides
            : familyGuides.slice(0, previewCount);
        const hiddenCount = familyGuides.length - previewCount;

        return (
          <section
            key={family}
            id={familyAnchor(family)}
            className={`py-10 ${famIdx % 2 === 0 ? "bg-white" : "bg-slate-50"}`}
          >
            <div className="container mx-auto px-4">
              <div className="max-w-5xl mx-auto">
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-green-600" />
                  {family}
                  <span className="text-sm font-normal text-gray-500">
                    ({familyGuides.length} guide
                    {familyGuides.length > 1 ? "s" : ""})
                  </span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {visibleGuides.map((guide) => (
                    <Link
                      key={guide.id}
                      to={`/blog-pieces-auto/guide-achat/${guide.slug}`}
                      prefetch="intent"
                      className="group block"
                    >
                      <Card className="h-full hover:shadow-xl hover:shadow-green-100/50 transition-all duration-300 border border-gray-100 hover:border-green-300 group-hover:-translate-y-0.5">
                        <div className="flex flex-row h-full">
                          <div className="relative w-36 flex-shrink-0 overflow-hidden">
                            {guide.featuredImage ? (
                              <ResponsiveImage
                                src={guide.featuredImage}
                                alt={cleanGuideTitle(guide.title)}
                                loading="lazy"
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                showPlaceholder
                                fallback="/images/pieces/default.png"
                                widths={[160, 240, 320]}
                                sizes="144px"
                              />
                            ) : (
                              <div className="relative w-full h-full min-h-[140px] overflow-hidden">
                                <img
                                  src={getFamilyCoverByTag(family)}
                                  alt=""
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                  loading="lazy"
                                />
                                <div className="absolute inset-0 bg-gradient-to-br from-green-700/50 to-emerald-800/30" />
                                <BookOpen className="absolute bottom-2 right-2 w-5 h-5 text-white/70" />
                              </div>
                            )}
                          </div>

                          <CardContent className="flex-1 p-4">
                            <h4 className="font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-green-600 transition-colors leading-tight">
                              {cleanGuideTitle(guide.title)}
                            </h4>

                            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                              {stripHtmlForMeta(guide.excerpt)}
                            </p>

                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              {guide.h2Count != null && guide.h2Count > 0 && (
                                <div className="flex items-center gap-1">
                                  <List className="w-3.5 h-3.5" />
                                  <span>{guide.h2Count} sections</span>
                                </div>
                              )}
                              {guide.readingTime != null &&
                                guide.readingTime > 0 && (
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>{guide.readingTime} min</span>
                                  </div>
                                )}
                              {guide.viewsCount != null &&
                                guide.viewsCount > 0 && (
                                  <div className="flex items-center gap-1">
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>{formatViews(guide.viewsCount)}</span>
                                  </div>
                                )}
                            </div>
                          </CardContent>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>

                {/* Afficher plus */}
                {hasMore && !isExpanded && (
                  <div className="mt-6 text-center">
                    <button
                      type="button"
                      onClick={() => toggleFamily(family)}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:border-green-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                    >
                      <ChevronDown className="w-4 h-4" />
                      Voir les {hiddenCount} autres guides
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      })}

      {/* ========== GUIDES LES PLUS COMPLETS ========== */}
      {topQualityGuides.length > 0 && (
        <section className="py-10 bg-gradient-to-br from-green-50 to-emerald-50 border-y border-green-100">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500" />
                Les guides les plus complets
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {topQualityGuides.map((guide) => (
                  <Link
                    key={guide.id}
                    to={`/blog-pieces-auto/guide-achat/${guide.slug}`}
                    prefetch="intent"
                    className="group block"
                  >
                    <Card className="h-full hover:shadow-lg transition-all duration-200 border border-green-100 hover:border-green-300 group-hover:-translate-y-0.5 bg-white overflow-hidden">
                      <div className="relative h-24 overflow-hidden">
                        <img
                          src={getFamilyCoverByTag(getFamily(guide))}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
                        <Star className="absolute top-2 right-2 w-4 h-4 text-amber-400 drop-shadow" />
                      </div>
                      <CardContent className="p-4 -mt-3 relative">
                        <h4 className="font-semibold text-gray-900 text-sm mb-2 line-clamp-2 group-hover:text-green-600 transition-colors leading-snug">
                          {cleanGuideTitle(guide.title)}
                        </h4>
                        <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                          {stripHtmlForMeta(guide.excerpt)}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          {guide.h2Count != null && guide.h2Count > 0 && (
                            <div className="flex items-center gap-1">
                              <List className="w-3 h-3" />
                              <span>{guide.h2Count} sections</span>
                            </div>
                          )}
                          {guide.readingTime != null &&
                            guide.readingTime > 0 && (
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>{guide.readingTime} min</span>
                              </div>
                            )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========== ETAT VIDE ========== */}
      {guides.length === 0 && (
        <section className="py-20">
          <div className="container mx-auto px-4 text-center">
            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Les guides d'achat arrivent bientot
            </h3>
            <p className="text-gray-600 mb-6">
              En attendant, consultez nos conseils d'experts
            </p>
            <Button
              asChild
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              <Link to="/blog-pieces-auto/conseils">
                Voir les conseils
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </section>
      )}

      {/* ========== CROSS-LINK CONSEILS ========== */}
      {relatedAdvice.length > 0 && (
        <section className="py-12 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-1">
                    Vous cherchez un tuto montage ?
                  </h3>
                  <p className="text-gray-600">
                    {totalAdvice} conseils de montage et entretien
                  </p>
                </div>
                <Link
                  to="/blog-pieces-auto/conseils"
                  className="hidden sm:inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  Voir tous les conseils
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {relatedAdvice.map((advice) => (
                  <Link
                    key={advice.id}
                    to={`/blog-pieces-auto/conseils/${advice.pg_alias || advice.slug}`}
                    className="group block"
                  >
                    <Card className="h-full hover:shadow-lg transition-all duration-200 border border-gray-100 hover:border-blue-200 group-hover:-translate-y-0.5">
                      <CardContent className="p-4">
                        <h4 className="font-semibold text-gray-900 text-sm mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors leading-snug">
                          {advice.title}
                        </h4>
                        <p className="text-xs text-gray-500 line-clamp-1 mb-3">
                          {stripHtmlForMeta(advice.excerpt)}
                        </p>
                        {advice.viewsCount != null && advice.viewsCount > 0 && (
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Eye className="w-3 h-3" />
                            <span>{formatViews(advice.viewsCount)}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>

              {/* Mobile link */}
              <div className="mt-6 text-center sm:hidden">
                <Button
                  asChild
                  variant="outline"
                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                >
                  <Link to="/blog-pieces-auto/conseils">
                    Voir les {totalAdvice} conseils
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========== CONTENU EDITORIAL SEO — 5 ETAPES ========== */}
      <section id="methode" className="py-12 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Comment choisir une piece auto compatible
            </h2>

            {/* Illustration methode */}
            <div className="relative rounded-xl overflow-hidden mb-8 h-40 md:h-52">
              <img
                src="/images/og/outil.webp"
                alt="Methode pour choisir une piece auto compatible"
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-green-800/60 to-transparent" />
              <div className="absolute bottom-4 left-4 text-white">
                <p className="text-lg font-bold">5 etapes cles</p>
                <p className="text-sm text-green-100">
                  De l'identification vehicule au bon choix
                </p>
              </div>
            </div>

            <h3 className="text-xl font-bold text-gray-900 mt-8 mb-3">
              1) Identifier votre vehicule (sans approximation)
            </h3>
            <p className="text-gray-600 leading-relaxed mb-4">
              Pour eviter les erreurs, partez d'une identification fiable :
              immatriculation, code VIN, ou selection precise (marque → modele →
              motorisation → annee). Une meme "piece" peut exister en plusieurs
              variantes (dimensions, connectique, puissance, type de montage).
            </p>
            <p className="text-gray-600 leading-relaxed mb-4">
              <strong>Conseil :</strong> si vous avez un doute, comparez aussi
              la reference d'origine (OEM) inscrite sur la piece.
            </p>

            <h3 className="text-xl font-bold text-gray-900 mt-8 mb-3">
              2) Comprendre les trois grandes qualites
            </h3>
            <ul className="text-gray-600 space-y-2 mb-4 list-disc list-inside">
              <li>
                <strong>OEM / origine :</strong> conforme a la piece d'usine,
                choix securite/fiabilite.
              </li>
              <li>
                <strong>Equipementier :</strong> marques qui fabriquent souvent
                pour les constructeurs (Bosch, Valeo, TRW, SKF...), excellent
                rapport qualite/prix.
              </li>
              <li>
                <strong>Adaptable :</strong> entree de gamme, adapte a un usage
                leger si la compatibilite est parfaite.
              </li>
            </ul>

            <h3 className="text-xl font-bold text-gray-900 mt-8 mb-3">
              3) Verifier les criteres techniques qui changent tout
            </h3>
            <p className="text-gray-600 leading-relaxed mb-4">
              Avant d'acheter, verifiez les criteres qui font la difference
              selon la piece : dimensions, puissance, connecteur, position, type
              de fixation, pression, debit, norme, capteur compatible, etc.
            </p>
            <p className="text-gray-600 leading-relaxed mb-4">
              <strong>
                Nos guides listent les criteres essentiels piece par piece
              </strong>{" "}
              (ex : alternateur → amperage + poulie ; disques → diametre +
              epaisseur + ventilation).
            </p>

            <h3 className="text-xl font-bold text-gray-900 mt-8 mb-3">
              4) Choisir selon l'usage et le budget
            </h3>
            <p className="text-gray-600 leading-relaxed mb-4">
              Un vehicule utilise en ville, sur autoroute ou charge
              regulierement n'a pas les memes besoins. Certaines pieces ont des
              variantes "standard" et "renforcees". Un bon achat, c'est souvent
              le meilleur compromis entre duree de vie, securite et cout total.
            </p>

            <h3
              id="etape-5"
              className="text-xl font-bold text-gray-900 mt-8 mb-3"
            >
              5) Eviter les erreurs frequentes
            </h3>
            <p className="text-gray-600 leading-relaxed mb-2">
              Les erreurs classiques : choisir "a l'oeil", se baser uniquement
              sur l'annee, ignorer une variante moteur, ou confondre une
              reference proche.
            </p>
            <p className="text-gray-600 leading-relaxed">
              <strong>Si votre objectif est de reparer / monter</strong>, passez
              plutot par nos{" "}
              <Link
                to="/blog-pieces-auto/conseils"
                className="text-blue-600 hover:text-blue-700 underline"
              >
                conseils pratiques
              </Link>{" "}
              (procedures, outils, etapes), car l'intention n'est pas la meme.
            </p>
          </div>
        </div>
      </section>

      {/* ========== TABLEAU COMPARATIF OEM ========== */}
      <section className="py-10 bg-slate-50 border-y border-gray-100">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              OEM, equipementier ou adaptable : quel niveau de qualite choisir ?
            </h2>
            <p className="text-gray-500 mb-6 text-sm">
              Comparatif rapide pour orienter votre choix selon l'usage et le
              budget.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="text-left p-3 font-semibold text-gray-700 border border-gray-200">
                      Critere
                    </th>
                    <th className="text-center p-3 font-semibold text-gray-700 border border-gray-200">
                      OEM (origine)
                    </th>
                    <th className="text-center p-3 font-semibold text-gray-700 border border-gray-200">
                      Equipementier
                    </th>
                    <th className="text-center p-3 font-semibold text-gray-700 border border-gray-200">
                      Adaptable
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-3 font-medium text-gray-700 border border-gray-200">
                      Prix
                    </td>
                    <td className="p-3 text-center border border-gray-200">
                      +++
                    </td>
                    <td className="p-3 text-center border border-gray-200">
                      ++
                    </td>
                    <td className="p-3 text-center border border-gray-200">
                      +
                    </td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="p-3 font-medium text-gray-700 border border-gray-200">
                      Duree de vie
                    </td>
                    <td className="p-3 text-center border border-gray-200">
                      Excellente
                    </td>
                    <td className="p-3 text-center border border-gray-200">
                      Tres bonne
                    </td>
                    <td className="p-3 text-center border border-gray-200">
                      Variable
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium text-gray-700 border border-gray-200">
                      Usage recommande
                    </td>
                    <td className="p-3 text-center border border-gray-200">
                      Tous
                    </td>
                    <td className="p-3 text-center border border-gray-200">
                      Tous
                    </td>
                    <td className="p-3 text-center border border-gray-200">
                      Leger
                    </td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="p-3 font-medium text-gray-700 border border-gray-200">
                      Risque d'erreur
                    </td>
                    <td className="p-3 text-center border border-gray-200">
                      Faible
                    </td>
                    <td className="p-3 text-center border border-gray-200">
                      Faible
                    </td>
                    <td className="p-3 text-center border border-gray-200">
                      Moyen
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ========== ANTI-CANNIBALISATION ========== */}
      <section className="py-6 bg-blue-50 border-b border-blue-100">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <Link
              to="/blog-pieces-auto/conseils"
              className="group flex items-center gap-4 rounded-lg p-3 hover:bg-blue-100/60 transition-colors"
            >
              <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                <img
                  src="/images/og/blog-conseil.webp"
                  alt="Conseils pratiques auto"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-blue-600/20" />
              </div>
              <div>
                <p className="text-sm font-semibold text-blue-800 group-hover:text-blue-900">
                  Vous cherchez une procedure de montage ?
                </p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Ce hub concerne le choix avant achat. Pour les tutoriels
                  pas-a-pas →{" "}
                  <span className="underline font-semibold">
                    conseils pratiques
                  </span>
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-blue-400 group-hover:text-blue-600 flex-shrink-0 ml-auto" />
            </Link>
          </div>
        </div>
      </section>

      {/* ========== E-E-A-T ========== */}
      <section className="py-8 bg-white border-b border-gray-100">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h3 className="text-base font-semibold text-gray-900 mb-2">
              Comment nous redigeons nos recommandations
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Fiches techniques constructeur, catalogues TecDoc/TecAlliance,
              retours clients verifies, croisement des references OEM. Nous ne
              recommandons pas de marque unique : chaque guide compare les
              options disponibles pour votre vehicule.
            </p>
          </div>
        </div>
      </section>

      {/* ========== FAQ SEO ========== */}
      <FaqSection />

      {/* ========== CTA FINAL ========== */}
      <section className="relative py-14 text-white overflow-hidden">
        <img
          src="/images/og/transaction.webp"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-green-700/90 to-emerald-700/85" />
        <div className="container mx-auto px-4 text-center relative">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Besoin de conseils personnalises ?
          </h2>
          <p className="text-green-100 mb-6 max-w-xl mx-auto">
            Nos experts vous aident a choisir les pieces adaptees a votre
            vehicule
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Button
              asChild
              size="lg"
              className="bg-white text-green-600 hover:bg-green-50 font-semibold px-6"
            >
              <Link to="/blog-pieces-auto/conseils">Explorer les conseils</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-2 border-white text-white hover:bg-white/10 font-semibold px-6"
            >
              <Link to="/blog-pieces-auto/auto">Pieces par constructeur</Link>
            </Button>
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
    return <ErrorGeneric status={error.status} message={error.data?.message} />;
  }

  return <ErrorGeneric />;
}
