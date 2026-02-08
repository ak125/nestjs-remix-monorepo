/**
 * API Client pour le glossaire automobile
 * Service optimisé pour gérer les définitions et termes techniques avec cache intelligent
 */

import { logger } from "~/utils/logger";

const _API_BASE_URL =
  typeof window !== "undefined" && window.ENV?.API_BASE_URL
    ? window.ENV.API_BASE_URL
    : "http://localhost:3000";

export interface GlossaryDefinition {
  id: string;
  word: string;
  definition: string;
  category?: string;
  synonyms?: string[];
  seeAlso?: string[];
  examples?: string[];
  etymology?: string;
  difficulty?: "basic" | "intermediate" | "advanced";
  relatedTerms?: string[];
  viewsCount: number;
  createdAt: string;
  updatedAt: string;
  seo_data?: {
    meta_title: string;
    meta_description: string;
    keywords: string[];
  };
}

export interface RelatedArticle {
  id: string;
  type: string;
  title: string;
  slug: string;
  excerpt: string;
  viewsCount: number;
  readingTime: number;
  publishedAt: string;
}

export interface GlossaryFilters {
  search?: string;
  category?: string;
  difficulty?: string;
  letter?: string;
  limit?: number;
  page?: number;
  sortBy?: "word" | "views" | "date" | "popularity";
  sortOrder?: "asc" | "desc";
}

export interface GlossaryResponse {
  success: boolean;
  data: {
    terms: GlossaryDefinition[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
    filters: GlossaryFilters;
    categories?: string[];
    stats?: {
      total: number;
      totalViews: number;
      avgViews: number;
      difficulties: Record<string, number>;
    };
  };
  error?: string;
}

// Données de démonstration pour le glossaire automobile
const DEMO_GLOSSARY: GlossaryDefinition[] = [
  {
    id: "glossary_1",
    word: "ABS",
    definition:
      "Le système ABS (Anti-lock Braking System ou système antiblocage des roues) est un système de sécurité active qui empêche les roues de se bloquer lors d'un freinage d'urgence, permettant ainsi de maintenir la directionnalité du véhicule.",
    category: "Système de sécurité",
    synonyms: ["Antiblocage", "Système antiblocage"],
    seeAlso: ["ESP", "EBD", "BAS"],
    examples: ["Freinage d'urgence sur route mouillée", "Évitement d'obstacle"],
    difficulty: "basic",
    relatedTerms: ["Freinage", "Sécurité active", "Adhérence"],
    viewsCount: 2450,
    createdAt: "2024-01-15T10:00:00.000Z",
    updatedAt: "2024-01-15T10:00:00.000Z",
    seo_data: {
      meta_title:
        "ABS - Système Antiblocage des Roues : Définition et Fonctionnement",
      meta_description:
        "Découvrez le système ABS, son rôle dans la sécurité automobile et son fonctionnement pour éviter le blocage des roues.",
      keywords: ["ABS", "antiblocage", "freinage", "sécurité"],
    },
  },
  {
    id: "glossary_2",
    word: "Turbo",
    definition:
      "Le turbocompresseur, communément appelé turbo, est un système de suralimentation qui utilise les gaz d'échappement pour comprimer l'air admis dans le moteur, augmentant ainsi sa puissance et son rendement.",
    category: "Moteur",
    synonyms: ["Turbocompresseur", "Suralimentation"],
    seeAlso: ["Compresseur", "Intercooler", "Wastegate"],
    examples: ["Moteur 2.0 TSI", "Turbo diesel TDI"],
    difficulty: "intermediate",
    relatedTerms: ["Suralimentation", "Puissance", "Rendement"],
    viewsCount: 3250,
    createdAt: "2024-01-10T14:30:00.000Z",
    updatedAt: "2024-01-10T14:30:00.000Z",
    seo_data: {
      meta_title: "Turbo - Turbocompresseur : Principe et Avantages",
      meta_description:
        "Comprendre le fonctionnement du turbocompresseur et ses avantages pour la performance moteur.",
      keywords: ["turbo", "turbocompresseur", "suralimentation", "moteur"],
    },
  },
  {
    id: "glossary_3",
    word: "ESP",
    definition:
      "L'ESP (Electronic Stability Program) ou contrôle électronique de la stabilité est un système de sécurité active qui corrige automatiquement la trajectoire du véhicule en cas de perte d'adhérence ou de dérapage.",
    category: "Système de sécurité",
    synonyms: ["ESC", "Contrôle de stabilité", "VSC"],
    seeAlso: ["ABS", "ASR", "EBD"],
    examples: ["Correction de sous-virage", "Stabilisation en virage"],
    difficulty: "intermediate",
    relatedTerms: ["Stabilité", "Adhérence", "Sécurité active"],
    viewsCount: 1890,
    createdAt: "2024-01-08T16:20:00.000Z",
    updatedAt: "2024-01-08T16:20:00.000Z",
    seo_data: {
      meta_title: "ESP - Contrôle Électronique de la Stabilité",
      meta_description:
        "Découvrez l'ESP, système essentiel pour la sécurité et la stabilité du véhicule.",
      keywords: ["ESP", "stabilité", "sécurité", "contrôle"],
    },
  },
  {
    id: "glossary_4",
    word: "FAP",
    definition:
      "Le FAP (Filtre à Particules) est un dispositif antipollution qui capture et brûle les particules fines contenues dans les gaz d'échappement des moteurs diesel pour réduire les émissions polluantes.",
    category: "Dépollution",
    synonyms: ["Filtre à particules", "DPF"],
    seeAlso: ["EGR", "SCR", "AdBlue"],
    examples: ["Régénération automatique", "Nettoyage haute température"],
    difficulty: "intermediate",
    relatedTerms: ["Dépollution", "Particules", "Émissions"],
    viewsCount: 2180,
    createdAt: "2024-01-05T09:15:00.000Z",
    updatedAt: "2024-01-05T09:15:00.000Z",
    seo_data: {
      meta_title:
        "FAP - Filtre à Particules Diesel : Fonctionnement et Entretien",
      meta_description:
        "Tout savoir sur le FAP, son rôle dans la dépollution diesel et son entretien.",
      keywords: ["FAP", "filtre particules", "diesel", "dépollution"],
    },
  },
  {
    id: "glossary_5",
    word: "DSG",
    definition:
      "La boîte DSG (Direct Shift Gearbox) est une transmission à double embrayage développée par Volkswagen qui permet des changements de rapport ultra-rapides sans interruption de couple.",
    category: "Transmission",
    synonyms: ["Boîte double embrayage", "Transmission DSG"],
    seeAlso: ["PDK", "Boîte automatique", "CVT"],
    examples: ["DSG 7 rapports", "Mode sportif S"],
    difficulty: "advanced",
    relatedTerms: ["Transmission", "Embrayage", "Changement de vitesse"],
    viewsCount: 1650,
    createdAt: "2024-01-12T11:45:00.000Z",
    updatedAt: "2024-01-12T11:45:00.000Z",
    seo_data: {
      meta_title: "DSG - Boîte à Double Embrayage : Technologie et Performance",
      meta_description:
        "Découvrez la technologie DSG et ses avantages en matière de performance et de confort.",
      keywords: ["DSG", "double embrayage", "transmission", "Volkswagen"],
    },
  },
  {
    id: "glossary_6",
    word: "AdBlue",
    definition:
      "L'AdBlue est une solution aqueuse d'urée utilisée dans le système SCR (Réduction Catalytique Sélective) pour réduire les émissions d'oxydes d'azote (NOx) des moteurs diesel.",
    category: "Dépollution",
    synonyms: ["Urée automobile", "DEF"],
    seeAlso: ["SCR", "NOx", "FAP"],
    examples: ["Réservoir AdBlue", "Injection SCR"],
    difficulty: "intermediate",
    relatedTerms: ["SCR", "NOx", "Dépollution"],
    viewsCount: 1420,
    createdAt: "2024-01-18T13:00:00.000Z",
    updatedAt: "2024-01-18T13:00:00.000Z",
    seo_data: {
      meta_title: "AdBlue - Solution SCR pour Moteurs Diesel",
      meta_description:
        "Comprendre l'AdBlue et son rôle dans la réduction des émissions NOx.",
      keywords: ["AdBlue", "SCR", "NOx", "diesel"],
    },
  },
];

const DEMO_ARTICLES: RelatedArticle[] = [
  {
    id: "article_1",
    type: "advice",
    title: "Comment entretenir son système ABS",
    slug: "entretien-systeme-abs",
    excerpt:
      "Guide complet pour maintenir votre système ABS en parfait état de fonctionnement.",
    viewsCount: 1250,
    readingTime: 6,
    publishedAt: "2024-01-20T10:00:00.000Z",
  },
  {
    id: "article_2",
    type: "advice",
    title: "Problèmes courants du turbo",
    slug: "problemes-turbo-solutions",
    excerpt:
      "Identifiez et résolvez les pannes les plus fréquentes du turbocompresseur.",
    viewsCount: 980,
    readingTime: 8,
    publishedAt: "2024-01-15T14:30:00.000Z",
  },
];

class GlossaryApiService {
  private cache = new Map<
    string,
    { data: any; timestamp: number; ttl: number }
  >();

  private getCacheKey(method: string, params: any = {}): string {
    const sortedParams = JSON.stringify(params, Object.keys(params).sort());
    return `glossary:${method}:${Buffer.from(sortedParams).toString("base64").slice(0, 16)}`;
  }

  private isValidCache(entry: { timestamp: number; ttl: number }): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }

  private calculateTTL(dataSize: number, isDefinition: boolean): number {
    if (isDefinition) return 30 * 60 * 1000; // 30 min pour définitions
    if (dataSize > 100) return 15 * 60 * 1000; // 15 min pour grandes listes
    return 10 * 60 * 1000; // 10 min standard
  }

  /**
   * Récupère la définition d'un mot
   */
  async getWordDefinition(word: string): Promise<GlossaryDefinition | null> {
    try {
      const cacheKey = this.getCacheKey("definition", { word });
      const cached = this.cache.get(cacheKey);

      if (cached && this.isValidCache(cached)) {
        logger.log("[CACHE HIT] Glossary definition:", word);
        return cached.data;
      }

      // Simulation avec données de démo
      const definition =
        DEMO_GLOSSARY.find(
          (d) => d.word.toLowerCase() === word.toLowerCase(),
        ) || null;

      logger.log("[DEMO] Found definition for:", word, !!definition);

      // Cache pour 30 minutes
      this.cache.set(cacheKey, {
        data: definition,
        timestamp: Date.now(),
        ttl: 30 * 60 * 1000,
      });

      return definition;
    } catch (error) {
      logger.error("[ERROR] Glossary definition API:", error);
      return null;
    }
  }

  /**
   * Récupère les articles liés à un mot
   */
  async getRelatedArticles(
    word: string,
    limit: number = 6,
  ): Promise<RelatedArticle[]> {
    try {
      const cacheKey = this.getCacheKey("related", { word, limit });
      const cached = this.cache.get(cacheKey);

      if (cached && this.isValidCache(cached)) {
        logger.log("[CACHE HIT] Related articles:", word);
        return cached.data;
      }

      // Simulation avec données de démo
      const wordLower = word.toLowerCase();
      const relatedArticles = DEMO_ARTICLES.filter(
        (article) =>
          article.title.toLowerCase().includes(wordLower) ||
          article.excerpt.toLowerCase().includes(wordLower) ||
          (wordLower.includes("abs") &&
            article.title.toLowerCase().includes("abs")) ||
          (wordLower.includes("turbo") &&
            article.title.toLowerCase().includes("turbo")),
      ).slice(0, limit);

      logger.log(
        "[DEMO] Found related articles for:",
        word,
        relatedArticles.length,
      );

      // Cache pour 15 minutes
      this.cache.set(cacheKey, {
        data: relatedArticles,
        timestamp: Date.now(),
        ttl: 15 * 60 * 1000,
      });

      return relatedArticles;
    } catch (error) {
      logger.error("[ERROR] Related articles API:", error);
      return [];
    }
  }

  /**
   * Récupère la liste des termes du glossaire avec filtres
   */
  async getGlossaryTerms(
    filters: GlossaryFilters = {},
  ): Promise<GlossaryResponse> {
    try {
      const cacheKey = this.getCacheKey("terms", filters);
      const cached = this.cache.get(cacheKey);

      if (cached && this.isValidCache(cached)) {
        logger.log("[CACHE HIT] Glossary terms:", cacheKey);
        return cached.data;
      }

      // Simulation avec données de démo
      let filteredTerms = DEMO_GLOSSARY;

      // Filtre par recherche
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredTerms = filteredTerms.filter(
          (term) =>
            term.word.toLowerCase().includes(searchLower) ||
            term.definition.toLowerCase().includes(searchLower),
        );
      }

      // Filtre par catégorie
      if (filters.category) {
        filteredTerms = filteredTerms.filter(
          (term) => term.category === filters.category,
        );
      }

      // Filtre par lettre
      if (filters.letter) {
        filteredTerms = filteredTerms.filter(
          (term) => term.word.charAt(0).toUpperCase() === filters.letter,
        );
      }

      // Filtre par difficulté
      if (filters.difficulty) {
        filteredTerms = filteredTerms.filter(
          (term) => term.difficulty === filters.difficulty,
        );
      }

      // Tri
      filteredTerms.sort((a, b) => {
        switch (filters.sortBy) {
          case "word":
            return a.word.localeCompare(b.word);
          case "views":
            return b.viewsCount - a.viewsCount;
          case "date":
            return (
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            );
          default:
            return a.word.localeCompare(b.word);
        }
      });

      // Pagination
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedTerms = filteredTerms.slice(startIndex, endIndex);
      const totalPages = Math.ceil(filteredTerms.length / limit);

      // Statistiques
      const categories = Array.from(
        new Set(
          DEMO_GLOSSARY.map((t) => t.category).filter(
            (c): c is string => typeof c === "string",
          ),
        ),
      );
      const stats = {
        total: DEMO_GLOSSARY.length,
        totalViews: DEMO_GLOSSARY.reduce((sum, t) => sum + t.viewsCount, 0),
        avgViews: Math.round(
          DEMO_GLOSSARY.reduce((sum, t) => sum + t.viewsCount, 0) /
            DEMO_GLOSSARY.length,
        ),
        difficulties: {
          basic: DEMO_GLOSSARY.filter((t) => t.difficulty === "basic").length,
          intermediate: DEMO_GLOSSARY.filter(
            (t) => t.difficulty === "intermediate",
          ).length,
          advanced: DEMO_GLOSSARY.filter((t) => t.difficulty === "advanced")
            .length,
        },
      };

      const result: GlossaryResponse = {
        success: true,
        data: {
          terms: paginatedTerms,
          total: filteredTerms.length,
          page,
          totalPages,
          limit,
          filters,
          categories,
          stats,
        },
      };

      // Cache intelligent
      const ttl = this.calculateTTL(paginatedTerms.length, false);
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
        ttl,
      });

      return result;
    } catch (error) {
      logger.error("[ERROR] Glossary terms API:", error);
      return {
        success: false,
        data: {
          terms: [],
          total: 0,
          page: 1,
          totalPages: 0,
          limit: 20,
          filters: {},
        },
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Recherche de termes avec suggestions
   */
  async searchTerms(
    query: string,
    limit: number = 10,
  ): Promise<GlossaryDefinition[]> {
    try {
      if (!query.trim()) return [];

      const cacheKey = this.getCacheKey("search", { query, limit });
      const cached = this.cache.get(cacheKey);

      if (cached && this.isValidCache(cached)) {
        return cached.data;
      }

      const queryLower = query.toLowerCase();
      const results = DEMO_GLOSSARY.filter(
        (term) =>
          term.word.toLowerCase().includes(queryLower) ||
          term.definition.toLowerCase().includes(queryLower) ||
          term.synonyms?.some((s) => s.toLowerCase().includes(queryLower)),
      )
        .sort((a, b) => {
          // Priorité : mot exact > début du mot > contenu
          const aWordMatch = a.word.toLowerCase().startsWith(queryLower);
          const bWordMatch = b.word.toLowerCase().startsWith(queryLower);
          if (aWordMatch && !bWordMatch) return -1;
          if (!aWordMatch && bWordMatch) return 1;
          return b.viewsCount - a.viewsCount;
        })
        .slice(0, limit);

      // Cache pour 5 minutes
      this.cache.set(cacheKey, {
        data: results,
        timestamp: Date.now(),
        ttl: 5 * 60 * 1000,
      });

      return results;
    } catch (error) {
      logger.error("[ERROR] Search terms API:", error);
      return [];
    }
  }

  /**
   * Nettoie le cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.log("[CACHE CLEARED] Glossary cache cleared");
  }

  /**
   * Statistiques du cache
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Export de l'instance singleton
export const glossaryApi = new GlossaryApiService();
