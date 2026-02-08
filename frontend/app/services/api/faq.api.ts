/**
 * Service FAQ API - Interface avec le backend FAQService
 * Gestion des questions fréquemment posées
 */

import { logger } from "~/utils/logger";

export interface FAQFormData {
  question: string;
  answer: string;
  category: string;
  tags?: string[];
  priority: "high" | "medium" | "low";
  status: "draft" | "published" | "archived";
}

export interface FAQRecord {
  id: string;
  question: string;
  answer: string;
  category: string;
  tags: string[];
  priority: "high" | "medium" | "low";
  status: "draft" | "published" | "archived";
  views: number;
  helpful_count: number;
  not_helpful_count: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface FAQStats {
  total_faqs: number;
  published_faqs: number;
  draft_faqs: number;
  total_views: number;
  average_helpfulness: number;
  top_categories: Array<{
    category: string;
    count: number;
  }>;
}

/**
 * Créer une nouvelle FAQ
 */
export async function createFAQ(
  faqData: FAQFormData,
  request?: Request,
): Promise<FAQRecord> {
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";

  try {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (request) {
      const cookie = request.headers.get("Cookie");
      if (cookie) {
        headers.Cookie = cookie;
      }
    }

    const response = await fetch(`${baseUrl}/api/support/faq`, {
      method: "POST",
      headers,
      body: JSON.stringify(faqData),
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const newFAQ = await response.json();
    return newFAQ;
  } catch (error) {
    logger.error("Erreur lors de la création de la FAQ:", error);
    throw error;
  }
}

/**
 * Récupérer une FAQ par ID
 */
export async function getFAQ(
  faqId: string,
  request?: Request,
): Promise<FAQRecord> {
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";

  try {
    const headers: HeadersInit = {
      Accept: "application/json",
    };

    if (request) {
      const cookie = request.headers.get("Cookie");
      if (cookie) {
        headers.Cookie = cookie;
      }
    }

    const response = await fetch(`${baseUrl}/api/support/faq/${faqId}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const faq = await response.json();
    return faq;
  } catch (error) {
    logger.error("Erreur lors de la récupération de la FAQ:", error);
    throw error;
  }
}

/**
 * Récupérer toutes les FAQs avec pagination
 */
export async function getAllFAQs(
  options: {
    page?: number;
    limit?: number;
    category?: string;
    status?: "draft" | "published" | "archived" | "all";
    search?: string;
  } = {},
  request?: Request,
): Promise<{
  faqs: FAQRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> {
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";

  try {
    const searchParams = new URLSearchParams({
      page: (options.page || 1).toString(),
      limit: (options.limit || 10).toString(),
    });

    if (options.category) searchParams.append("category", options.category);
    if (options.status && options.status !== "all")
      searchParams.append("status", options.status);
    if (options.search) searchParams.append("search", options.search);

    const headers: HeadersInit = {
      Accept: "application/json",
    };

    if (request) {
      const cookie = request.headers.get("Cookie");
      if (cookie) {
        headers.Cookie = cookie;
      }
    }

    const response = await fetch(`${baseUrl}/api/support/faq?${searchParams}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    logger.error("Erreur lors de la récupération des FAQs:", error);
    throw error;
  }
}

/**
 * Mettre à jour une FAQ
 */
export async function updateFAQ(
  faqId: string,
  updateData: Partial<FAQFormData>,
  request?: Request,
): Promise<FAQRecord> {
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";

  try {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (request) {
      const cookie = request.headers.get("Cookie");
      if (cookie) {
        headers.Cookie = cookie;
      }
    }

    const response = await fetch(`${baseUrl}/api/support/faq/${faqId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const updatedFAQ = await response.json();
    return updatedFAQ;
  } catch (error) {
    logger.error("Erreur lors de la mise à jour de la FAQ:", error);
    throw error;
  }
}

/**
 * Supprimer une FAQ
 */
export async function deleteFAQ(
  faqId: string,
  request?: Request,
): Promise<void> {
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";

  try {
    const headers: HeadersInit = {
      Accept: "application/json",
    };

    if (request) {
      const cookie = request.headers.get("Cookie");
      if (cookie) {
        headers.Cookie = cookie;
      }
    }

    const response = await fetch(`${baseUrl}/api/support/faq/${faqId}`, {
      method: "DELETE",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
  } catch (error) {
    logger.error("Erreur lors de la suppression de la FAQ:", error);
    throw error;
  }
}

/**
 * Récupérer les statistiques des FAQs
 */
export async function getFAQStats(request?: Request): Promise<FAQStats> {
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";

  try {
    const headers: HeadersInit = {
      Accept: "application/json",
    };

    if (request) {
      const cookie = request.headers.get("Cookie");
      if (cookie) {
        headers.Cookie = cookie;
      }
    }

    const response = await fetch(`${baseUrl}/api/support/faq/stats`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const stats = await response.json();
    return stats;
  } catch (error) {
    logger.error("Erreur lors de la récupération des stats FAQ:", error);
    throw error;
  }
}

/**
 * Marquer une FAQ comme utile
 */
export async function markFAQHelpful(
  faqId: string,
  helpful: boolean,
  request?: Request,
): Promise<void> {
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";

  try {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (request) {
      const cookie = request.headers.get("Cookie");
      if (cookie) {
        headers.Cookie = cookie;
      }
    }

    const response = await fetch(
      `${baseUrl}/api/support/faq/${faqId}/feedback`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ helpful }),
      },
    );

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
  } catch (error) {
    logger.error("Erreur lors du feedback FAQ:", error);
    throw error;
  }
}

/**
 * Rechercher dans les FAQs
 */
export async function searchFAQs(
  query: string,
  options: {
    category?: string;
    limit?: number;
  } = {},
  request?: Request,
): Promise<FAQRecord[]> {
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";

  try {
    const searchParams = new URLSearchParams({
      q: query,
      limit: (options.limit || 10).toString(),
    });

    if (options.category) searchParams.append("category", options.category);

    const headers: HeadersInit = {
      Accept: "application/json",
    };

    if (request) {
      const cookie = request.headers.get("Cookie");
      if (cookie) {
        headers.Cookie = cookie;
      }
    }

    const response = await fetch(
      `${baseUrl}/api/support/faq/search?${searchParams}`,
      {
        method: "GET",
        headers,
      },
    );

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const results = await response.json();
    return results;
  } catch (error) {
    logger.error("Erreur lors de la recherche FAQ:", error);
    throw error;
  }
}

/**
 * Récupérer les catégories de FAQs
 */
export async function getFAQCategories(request?: Request): Promise<string[]> {
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";

  try {
    const headers: HeadersInit = {
      Accept: "application/json",
    };

    if (request) {
      const cookie = request.headers.get("Cookie");
      if (cookie) {
        headers.Cookie = cookie;
      }
    }

    const response = await fetch(`${baseUrl}/api/support/faq/categories`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const categories = await response.json();
    return categories;
  } catch (error) {
    logger.error("Erreur lors de la récupération des catégories FAQ:", error);
    throw error;
  }
}
