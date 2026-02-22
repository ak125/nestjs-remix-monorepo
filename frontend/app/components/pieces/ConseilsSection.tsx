import {
  ChevronDown,
  ChevronUp,
  Lightbulb,
  BookOpen,
  Search,
  Settings,
  RefreshCw,
} from "lucide-react";
import { useState, useMemo, memo } from "react";

import { pluralizePieceName } from "~/lib/seo-utils";
import { HtmlContent } from "../seo/HtmlContent";

interface ConseilItem {
  id: number;
  title: string;
  content: string;
}

interface CatalogueItem {
  id?: number;
  name: string;
  alias?: string;
  link?: string;
  image?: string;
  description?: string;
  meta_description?: string;
  sort?: number;
}

interface ConseilsSectionProps {
  conseils?: {
    title: string;
    content: string;
    items: ConseilItem[];
  };
  catalogueFamille?: CatalogueItem[];
  gammeName?: string;
  isDarkMode?: boolean;
}

// Limite de conseils visibles par défaut
const VISIBLE_LIMIT = 3;

// Mots-clés pour catégoriser les conseils
const CONSEIL_CATEGORIES: Record<string, string[]> = {
  choix: [
    "choisir",
    "sélectionner",
    "qualité",
    "marque",
    "OE",
    "équivalent",
    "prix",
    "gamme",
    "budget",
    "économique",
    "premium",
    "origine",
    "équipementier",
  ],
  fonctionnement: [
    "fonctionne",
    "système",
    "pression",
    "hydraulique",
    "friction",
    "température",
    "rôle",
    "principe",
    "mécanique",
    "technique",
  ],
  remplacement: [
    "remplacer",
    "changer",
    "monter",
    "démonter",
    "paire",
    "essieu",
    "kit",
    "rodage",
    "usure",
    "symptôme",
    "quand",
    "intervalle",
  ],
};

// Labels des catégories
const CATEGORY_LABELS: Record<
  string,
  { label: string; icon: "search" | "settings" | "refresh" }
> = {
  choix: { label: "Choix", icon: "search" },
  fonctionnement: { label: "Fonctionnement", icon: "settings" },
  remplacement: { label: "Remplacement", icon: "refresh" },
};

/**
 * Catégorise un conseil selon les mots-clés
 */
function categorizeConseil(title: string, content: string): string {
  const text = (title + " " + content).toLowerCase();
  for (const [category, keywords] of Object.entries(CONSEIL_CATEGORIES)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return category;
      }
    }
  }
  return "general";
}

/**
 * Ajoute des liens vers les gammes connexes dans le contenu HTML des conseils
 */
function addGammeLinksToHtml(
  html: string,
  catalogueFamille?: CatalogueItem[],
): string {
  if (
    !catalogueFamille ||
    !Array.isArray(catalogueFamille) ||
    catalogueFamille.length === 0
  )
    return html;

  const uniqueGammes = catalogueFamille.filter(
    (gamme, index, self) =>
      index === self.findIndex((g) => g.name === gamme.name),
  );

  let result = html;
  const linkedGammes = new Set<string>();

  for (const gamme of uniqueGammes) {
    if (!gamme || !gamme.name) continue;

    const gammeUrl =
      gamme.link ||
      (gamme.alias && gamme.id
        ? `/pieces/${gamme.alias}-${gamme.id}.html`
        : null);
    if (!gammeUrl) continue;
    if (linkedGammes.has(gamme.name)) continue;

    const name = gamme.name.toLowerCase();
    const patterns = [
      name,
      name + "s",
      name.replace("é", "e"),
      (name + "s").replace("é", "e"),
    ];

    for (const pattern of patterns) {
      const regex = new RegExp(
        `(?<!<a[^>]*>)\\b(${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\b(?![^<]*<\\/a>)`,
        "gi",
      );

      if (regex.test(result) && !linkedGammes.has(gamme.name)) {
        result = result.replace(regex, (match) => {
          linkedGammes.add(gamme.name);
          return `<a href="${gammeUrl}" class="text-green-600 hover:text-green-800 underline decoration-dotted hover:decoration-solid font-medium" title="Voir nos ${gamme.name}">${match}</a>`;
        });
        break;
      }
    }
  }

  return result;
}

// Composant pour un conseil individuel
interface ConseilCardProps {
  conseil: ConseilItem & { contentWithLinks: string };
  isExpanded: boolean;
  onToggle: () => void;
  catalogueFamille?: CatalogueItem[];
  gammeName?: string;
}

function ConseilCard({
  conseil,
  isExpanded,
  onToggle,
  catalogueFamille,
  gammeName,
}: ConseilCardProps) {
  const preview = conseil.content.substring(0, 150);
  const previewWithLinks = addGammeLinksToHtml(preview, catalogueFamille);
  const needsExpansion = conseil.content.length > 150;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden hover:border-green-300 transition-colors">
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-bold">
            {conseil.id}
          </span>
          {conseil.title}
        </h3>

        <div className="text-gray-700 leading-relaxed pl-9">
          <HtmlContent
            html={
              isExpanded
                ? conseil.contentWithLinks
                : previewWithLinks + (needsExpansion ? "..." : "")
            }
            trackLinks={true}
          />

          {needsExpansion && (
            <button
              onClick={onToggle}
              className="mt-2 inline-flex items-center text-green-600 hover:text-green-700 font-medium text-sm transition-colors"
              title={
                gammeName
                  ? `Conseil complet ${gammeName} - Blog Automecanik`
                  : "Voir le conseil complet"
              }
            >
              {isExpanded ? (
                <>
                  Réduire
                  <ChevronUp className="w-4 h-4 ml-1" />
                </>
              ) : (
                <>
                  Lire la suite
                  <ChevronDown className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const ConseilsSection = memo(function ConseilsSection({
  conseils,
  catalogueFamille,
  gammeName,
}: ConseilsSectionProps) {
  // Use array instead of Set to avoid React hydration issues
  const [expandedItems, setExpandedItems] = useState<number[]>([]);
  const [showAllConseils, setShowAllConseils] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const pluralGammeName = gammeName
    ? pluralizePieceName(gammeName.toLowerCase())
    : null;

  const processedConseils = useMemo(() => {
    if (!conseils?.items) return [];
    return conseils.items.map((conseil) => ({
      ...conseil,
      contentWithLinks: addGammeLinksToHtml(conseil.content, catalogueFamille),
      category: categorizeConseil(conseil.title, conseil.content),
    }));
  }, [conseils?.items, catalogueFamille]);

  // Compter les conseils par catégorie
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      choix: 0,
      fonctionnement: 0,
      remplacement: 0,
    };
    processedConseils.forEach((conseil) => {
      if (counts[conseil.category] !== undefined) {
        counts[conseil.category]++;
      }
    });
    return counts;
  }, [processedConseils]);

  if (!conseils?.items || conseils.items.length === 0) {
    return null;
  }

  const toggleExpanded = (id: number) => {
    setExpandedItems((prev) => {
      if (prev.includes(id)) {
        return prev.filter((i) => i !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  // Filtrer les conseils selon le filtre actif
  const filteredConseils = activeFilter
    ? processedConseils.filter((c) => c.category === activeFilter)
    : processedConseils;

  const visibleConseils = showAllConseils
    ? filteredConseils
    : filteredConseils.slice(0, VISIBLE_LIMIT);
  const hiddenCount = filteredConseils.length - VISIBLE_LIMIT;
  const hasMore = filteredConseils.length > VISIBLE_LIMIT;

  // Rendu des icônes
  const renderIcon = (iconType: string) => {
    switch (iconType) {
      case "search":
        return <Search className="w-3.5 h-3.5" />;
      case "settings":
        return <Settings className="w-3.5 h-3.5" />;
      case "refresh":
        return <RefreshCw className="w-3.5 h-3.5" />;
      default:
        return null;
    }
  };

  return (
    <section className="bg-white rounded-xl shadow-lg mb-8 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 p-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <Lightbulb className="w-7 h-7" />
          {pluralGammeName
            ? `Conseils d'entretien pour vos ${pluralGammeName}`
            : conseils.title}
        </h2>
        <p className="text-green-100 text-sm mt-1">
          {VISIBLE_LIMIT} conseils essentiels
          {hasMore ? ` + ${hiddenCount} conseils d'expert` : ""}
        </p>
        {/* Chips de filtrage */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="text-green-200 text-sm flex items-center gap-1">
            <Search className="w-3.5 h-3.5" />
            Filtrer par :
          </span>
          <button
            onClick={() => setActiveFilter(null)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-white/50 ${
              activeFilter === null
                ? "bg-white text-green-700"
                : "bg-green-500/30 text-white hover:bg-green-500/50"
            }`}
          >
            Tous ({processedConseils.length})
          </button>
          {Object.entries(CATEGORY_LABELS).map(
            ([key, { label, icon }]) =>
              categoryCounts[key] > 0 && (
                <button
                  key={key}
                  onClick={() =>
                    setActiveFilter(activeFilter === key ? null : key)
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-white/50 ${
                    activeFilter === key
                      ? "bg-white text-green-700"
                      : "bg-green-500/30 text-white hover:bg-green-500/50"
                  }`}
                >
                  {renderIcon(icon)}
                  {label}
                  <span className="bg-green-800/30 px-1.5 py-0.5 rounded-full text-xs">
                    {categoryCounts[key]}
                  </span>
                </button>
              ),
          )}
        </div>
      </div>

      <div className="p-6">
        {/* Conseils principaux (toujours visibles) */}
        <div className="space-y-4">
          {visibleConseils.slice(0, VISIBLE_LIMIT).map((conseil) => (
            <ConseilCard
              key={conseil.id}
              conseil={conseil}
              isExpanded={expandedItems.includes(conseil.id)}
              onToggle={() => toggleExpanded(conseil.id)}
              catalogueFamille={catalogueFamille}
              gammeName={gammeName}
            />
          ))}
        </div>

        {/* Conseils supplémentaires (accordéon) */}
        {hasMore && (
          <div className="mt-6">
            <button
              onClick={() => setShowAllConseils(!showAllConseils)}
              className="w-full flex items-center justify-between p-4 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors"
              aria-expanded={showAllConseils}
            >
              <div className="flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-900">
                  {showAllConseils
                    ? "Masquer les conseils supplémentaires"
                    : `Voir ${hiddenCount} conseils d'expert supplémentaires`}
                </span>
              </div>
              {showAllConseils ? (
                <ChevronUp className="w-5 h-5 text-green-600" />
              ) : (
                <ChevronDown className="w-5 h-5 text-green-600" />
              )}
            </button>

            {/* Conseils cachés */}
            {showAllConseils && (
              <div className="mt-4 space-y-4 animate-in slide-in-from-top duration-300">
                {visibleConseils.slice(VISIBLE_LIMIT).map((conseil) => (
                  <ConseilCard
                    key={conseil.id}
                    conseil={conseil}
                    isExpanded={expandedItems.includes(conseil.id)}
                    onToggle={() => toggleExpanded(conseil.id)}
                    catalogueFamille={catalogueFamille}
                    gammeName={gammeName}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
});

export default ConseilsSection;
