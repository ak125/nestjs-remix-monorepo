import {
  Info,
  Settings,
  AlertTriangle,
  CheckCircle,
  Wrench,
  ChevronDown,
} from "lucide-react";
import { useMemo, memo } from "react";

import { HtmlContent } from "../seo/HtmlContent";
import { pluralizePieceName } from "~/lib/seo-utils";

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

interface InformationsSectionProps {
  informations?: {
    title: string;
    content: string;
    items: string[];
  };
  catalogueFamille?: CatalogueItem[];
  gammeName?: string;
}

// Mots-clés pour catégoriser les informations
const CATEGORY_KEYWORDS = {
  fonctionnement: [
    "frottement",
    "disque",
    "étrier",
    "piston",
    "hydraulique",
    "pression",
    "température",
    "énergie",
    "cinétique",
    "thermique",
    "mécanique",
    "système",
    "appui",
    "contact",
    "rotation",
  ],
  usure: [
    "usure",
    "épaisseur",
    "garniture",
    "kilomètre",
    "km",
    "durée",
    "vie",
    "remplacement",
    "témoin",
    "voyant",
    "seuil",
    "minimum",
    "contrôle",
    "vérif",
    "révision",
  ],
  securite: [
    "sécurité",
    "danger",
    "risque",
    "distance",
    "freinage",
    "arrêt",
    "urgence",
    "accident",
    "obligatoire",
    "critique",
    "vital",
    "essentiel",
  ],
  pratiques: [
    "conseil",
    "recommand",
    "entretien",
    "montage",
    "paire",
    "essieu",
    "avant",
    "arrière",
    "professionnel",
    "garagiste",
    "neuf",
    "qualité",
    "marque",
    "OE",
    "origine",
  ],
};

// Configuration des thèmes avec leurs couleurs et icônes
const THEME_CONFIG: Record<
  string,
  {
    title: string;
    icon: "settings" | "alert" | "wrench" | "info";
    colors: {
      bg: string;
      border: string;
      text: string;
      badge: string;
      iconBg: string;
    };
  }
> = {
  fonctionnement: {
    title: "Fonctionnement du système",
    icon: "settings",
    colors: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-800",
      badge: "bg-blue-200 text-blue-800",
      iconBg: "bg-blue-100 text-blue-600",
    },
  },
  usure: {
    title: "Usure & durée de vie",
    icon: "alert",
    colors: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-800",
      badge: "bg-amber-200 text-amber-800",
      iconBg: "bg-amber-100 text-amber-600",
    },
  },
  securite: {
    title: "Sécurité & risques",
    icon: "alert",
    colors: {
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-800",
      badge: "bg-red-200 text-red-800",
      iconBg: "bg-red-100 text-red-600",
    },
  },
  pratiques: {
    title: "Bonnes pratiques & recommandations",
    icon: "wrench",
    colors: {
      bg: "bg-indigo-50",
      border: "border-indigo-200",
      text: "text-indigo-800",
      badge: "bg-indigo-200 text-indigo-800",
      iconBg: "bg-indigo-100 text-indigo-600",
    },
  },
  general: {
    title: "Autres informations",
    icon: "info",
    colors: {
      bg: "bg-gray-50",
      border: "border-gray-200",
      text: "text-gray-800",
      badge: "bg-gray-200 text-gray-800",
      iconBg: "bg-gray-100 text-gray-600",
    },
  },
};

/**
 * Catégorise une phrase selon les mots-clés
 */
function categorizeItem(text: string): string {
  const lowerText = text.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        return category;
      }
    }
  }
  return "general";
}

/**
 * Ajoute des liens vers les gammes connexes dans le texte des informations
 */
function addGammeLinksToText(
  text: string,
  catalogueFamille?: CatalogueItem[],
): string {
  if (
    !catalogueFamille ||
    !Array.isArray(catalogueFamille) ||
    catalogueFamille.length === 0
  )
    return text;

  const uniqueGammes = catalogueFamille.filter(
    (gamme, index, self) =>
      index === self.findIndex((g) => g.name === gamme.name),
  );

  let result = text;
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
          return `<a href="${gammeUrl}" class="text-indigo-600 hover:text-indigo-800 underline decoration-dotted hover:decoration-solid font-medium" title="Voir nos ${gamme.name}">${match}</a>`;
        });
        break;
      }
    }
  }

  return result;
}

/**
 * Rendu de l'icône selon le type
 */
function ThemeIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case "settings":
      return <Settings className={className || "w-5 h-5"} />;
    case "alert":
      return <AlertTriangle className={className || "w-5 h-5"} />;
    case "wrench":
      return <Wrench className={className || "w-5 h-5"} />;
    default:
      return <Info className={className || "w-5 h-5"} />;
  }
}

/**
 * Composant Details/Summary natif HTML5 (SEO-friendly)
 * Le contenu est TOUJOURS dans le DOM → indexable par Google
 */
interface ThemeDetailsProps {
  themeKey: string;
  items: string[];
}

function ThemeDetails({ themeKey, items }: ThemeDetailsProps) {
  if (items.length === 0) return null;

  const config = THEME_CONFIG[themeKey] || THEME_CONFIG.general;

  return (
    <details
      className={`group border-2 ${config.colors.border} rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow`}
    >
      <summary
        className={`flex items-center justify-between p-4 ${config.colors.bg} cursor-pointer list-none hover:brightness-95 transition-all`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex items-center justify-center w-8 h-8 rounded-full ${config.colors.iconBg}`}
          >
            <ThemeIcon type={config.icon} />
          </span>
          <h3 className="font-semibold text-gray-900">{config.title}</h3>
          <span
            className={`text-xs font-medium px-2.5 py-1 rounded-full ${config.colors.badge}`}
          >
            {items.length}
          </span>
        </div>
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-white/50 group-open:rotate-180 transition-transform duration-200">
          <ChevronDown className="w-4 h-4 text-gray-600" />
        </span>
      </summary>

      {/* Contenu toujours dans le DOM (SEO) - CSS gère l'affichage */}
      <div className="p-4 pt-3 space-y-2 bg-white border-t border-gray-100">
        {items.map((item, index) => (
          <div
            key={index}
            className="flex items-start gap-2 text-sm text-gray-700"
          >
            <span className="text-gray-400 mt-1">•</span>
            <HtmlContent
              html={item}
              className="flex-1 leading-relaxed"
              trackLinks={true}
            />
          </div>
        ))}
      </div>
    </details>
  );
}

const InformationsSection = memo(function InformationsSection({
  informations,
  catalogueFamille,
  gammeName,
}: InformationsSectionProps) {
  const pluralGammeName = gammeName
    ? pluralizePieceName(gammeName.toLowerCase())
    : null;

  // Traiter et catégoriser les informations
  const { essentials, categories } = useMemo(() => {
    if (!informations?.items)
      return {
        essentials: [],
        categories: {
          fonctionnement: [],
          usure: [],
          securite: [],
          pratiques: [],
          general: [],
        },
      };

    const processed = informations.items.map((item) => ({
      original: item,
      html: addGammeLinksToText(item, catalogueFamille),
      category: categorizeItem(item),
    }));

    // L'essentiel : les 5 premières phrases (priorité SEO)
    const essentialItems = processed.slice(0, 5).map((p) => p.html);

    // Reste catégorisé par thème
    const remaining = processed.slice(5);
    const cats: Record<string, string[]> = {
      fonctionnement: [],
      usure: [],
      securite: [],
      pratiques: [],
      general: [],
    };

    remaining.forEach((item) => {
      if (cats[item.category]) {
        cats[item.category].push(item.html);
      } else {
        cats.general.push(item.html);
      }
    });

    return { essentials: essentialItems, categories: cats };
  }, [informations?.items, catalogueFamille]);

  if (!informations?.items || informations.items.length === 0) {
    return null;
  }

  const hasThemes = Object.values(categories).some((arr) => arr.length > 0);
  const themeCount = Object.values(categories).filter(
    (arr) => arr.length > 0,
  ).length;

  return (
    <section className="bg-white rounded-xl shadow-lg mb-8 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <Info className="w-7 h-7" />
          {pluralGammeName
            ? `Informations essentielles sur les ${pluralGammeName}`
            : informations.title}
        </h2>
        <p className="text-indigo-100 text-sm mt-1">
          {essentials.length} points clés
          {hasThemes ? ` + ${themeCount} thèmes experts` : ""}
        </p>
      </div>

      <div className="p-6">
        {/* Bloc visible : L'essentiel (toujours affiché - priorité SEO) */}
        <div className="mb-8 p-5 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-600">
              <CheckCircle className="w-5 h-5" />
            </span>
            L'essentiel à savoir avant de commander
          </h3>
          <p className="text-sm text-gray-500 mb-2 ml-10">
            {essentials.length} points clés pour comprendre le rôle et l'usure
            des {pluralGammeName || "pièces"}
          </p>
          <p className="text-sm text-green-600 ml-10 mb-4 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span>
              Nous filtrons selon votre véhicule et votre essieu (avant/arrière)
              pour éviter toute erreur de compatibilité.
            </span>
          </p>
          <div className="space-y-3 ml-10">
            {essentials.map((infoHtml, index) => (
              <div key={index} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-bold shadow-sm">
                  {index + 1}
                </span>
                <HtmlContent
                  html={infoHtml}
                  className="flex-1 text-gray-700 leading-relaxed"
                  trackLinks={true}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Thèmes avec <details>/<summary> natif HTML5 (SEO-friendly) */}
        {hasThemes && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 mb-2 flex items-center gap-2">
              <Info className="w-4 h-4" />
              Cliquez sur un thème pour voir les détails
            </p>

            {categories.fonctionnement.length > 0 && (
              <ThemeDetails
                themeKey="fonctionnement"
                items={categories.fonctionnement}
              />
            )}

            {categories.usure.length > 0 && (
              <ThemeDetails themeKey="usure" items={categories.usure} />
            )}

            {categories.securite.length > 0 && (
              <ThemeDetails themeKey="securite" items={categories.securite} />
            )}

            {categories.pratiques.length > 0 && (
              <ThemeDetails themeKey="pratiques" items={categories.pratiques} />
            )}

            {categories.general.length > 0 && (
              <ThemeDetails themeKey="general" items={categories.general} />
            )}
          </div>
        )}
      </div>
    </section>
  );
});

export default InformationsSection;
