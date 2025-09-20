/**
 * Service Quote API - Interface avec le backend QuoteService
 * Gestion des demandes de devis personnalisés
 */

export interface QuoteFormData {
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  company_name?: string;
  project_description: string;
  requirements: string[];
  budget_range?: 'under_1k' | '1k_5k' | '5k_10k' | '10k_25k' | '25k_50k' | 'over_50k';
  timeline?: 'urgent' | 'within_month' | 'within_quarter' | 'flexible';
  preferred_contact: 'email' | 'phone' | 'both';
  additional_info?: string;
  attachments?: string[];
}

export interface QuoteRecord {
  id: string;
  quote_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  company_name?: string;
  project_description: string;
  requirements: string[];
  budget_range?: string;
  timeline?: string;
  preferred_contact: string;
  additional_info?: string;
  attachments: string[];
  status: 'pending' | 'in_review' | 'quoted' | 'accepted' | 'rejected' | 'expired';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimated_value?: number;
  quote_amount?: number;
  quote_valid_until?: string;
  quote_details?: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  responded_at?: string;
  notes?: Array<{
    id: string;
    content: string;
    created_by: string;
    created_at: string;
  }>;
}

export interface QuoteStats {
  total_quotes: number;
  pending_quotes: number;
  in_review_quotes: number;
  quoted_quotes: number;
  accepted_quotes: number;
  conversion_rate: number;
  average_quote_value: number;
  total_quoted_value: number;
  response_time_avg: number;
  quotes_this_month: number;
  quotes_last_month: number;
}

/**
 * Créer une nouvelle demande de devis
 */
export async function createQuote(
  quoteData: QuoteFormData,
  request?: Request
): Promise<QuoteRecord> {
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

    const response = await fetch(`${baseUrl}/api/support/quotes`, {
      method: "POST",
      headers,
      body: JSON.stringify(quoteData),
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const newQuote = await response.json();
    return newQuote;
  } catch (error) {
    console.error("Erreur lors de la création du devis:", error);
    throw error;
  }
}

/**
 * Récupérer un devis par ID
 */
export async function getQuote(
  quoteId: string,
  request?: Request
): Promise<QuoteRecord> {
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

    const response = await fetch(`${baseUrl}/api/support/quotes/${quoteId}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const quote = await response.json();
    return quote;
  } catch (error) {
    console.error("Erreur lors de la récupération du devis:", error);
    throw error;
  }
}

/**
 * Récupérer tous les devis avec pagination
 */
export async function getAllQuotes(
  options: {
    page?: number;
    limit?: number;
    status?: 'pending' | 'in_review' | 'quoted' | 'accepted' | 'rejected' | 'expired' | 'all';
    priority?: 'low' | 'medium' | 'high' | 'urgent' | 'all';
    assigned_to?: string;
    search?: string;
    date_from?: string;
    date_to?: string;
  } = {},
  request?: Request
): Promise<{
  quotes: QuoteRecord[];
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

    if (options.status && options.status !== "all") searchParams.append("status", options.status);
    if (options.priority && options.priority !== "all") searchParams.append("priority", options.priority);
    if (options.assigned_to) searchParams.append("assigned_to", options.assigned_to);
    if (options.search) searchParams.append("search", options.search);
    if (options.date_from) searchParams.append("date_from", options.date_from);
    if (options.date_to) searchParams.append("date_to", options.date_to);

    const headers: HeadersInit = {
      Accept: "application/json",
    };

    if (request) {
      const cookie = request.headers.get("Cookie");
      if (cookie) {
        headers.Cookie = cookie;
      }
    }

    const response = await fetch(`${baseUrl}/api/support/quotes?${searchParams}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Erreur lors de la récupération des devis:", error);
    throw error;
  }
}

/**
 * Mettre à jour un devis
 */
export async function updateQuote(
  quoteId: string,
  updateData: Partial<QuoteRecord>,
  request?: Request
): Promise<QuoteRecord> {
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

    const response = await fetch(`${baseUrl}/api/support/quotes/${quoteId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const updatedQuote = await response.json();
    return updatedQuote;
  } catch (error) {
    console.error("Erreur lors de la mise à jour du devis:", error);
    throw error;
  }
}

/**
 * Supprimer un devis
 */
export async function deleteQuote(
  quoteId: string,
  request?: Request
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

    const response = await fetch(`${baseUrl}/api/support/quotes/${quoteId}`, {
      method: "DELETE",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
  } catch (error) {
    console.error("Erreur lors de la suppression du devis:", error);
    throw error;
  }
}

/**
 * Récupérer les statistiques des devis
 */
export async function getQuoteStats(
  request?: Request
): Promise<QuoteStats> {
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

    const response = await fetch(`${baseUrl}/api/support/quotes/stats`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const stats = await response.json();
    return stats;
  } catch (error) {
    console.error("Erreur lors de la récupération des stats devis:", error);
    throw error;
  }
}

/**
 * Assigner un devis à un agent
 */
export async function assignQuote(
  quoteId: string,
  agentId: string,
  request?: Request
): Promise<QuoteRecord> {
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

    const response = await fetch(`${baseUrl}/api/support/quotes/${quoteId}/assign`, {
      method: "POST",
      headers,
      body: JSON.stringify({ assigned_to: agentId }),
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const assignedQuote = await response.json();
    return assignedQuote;
  } catch (error) {
    console.error("Erreur lors de l'assignation du devis:", error);
    throw error;
  }
}

/**
 * Ajouter une note à un devis
 */
export async function addQuoteNote(
  quoteId: string,
  content: string,
  request?: Request
): Promise<QuoteRecord> {
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

    const response = await fetch(`${baseUrl}/api/support/quotes/${quoteId}/notes`, {
      method: "POST",
      headers,
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const updatedQuote = await response.json();
    return updatedQuote;
  } catch (error) {
    console.error("Erreur lors de l'ajout de la note:", error);
    throw error;
  }
}

/**
 * Soumettre un devis final
 */
export async function submitFinalQuote(
  quoteId: string,
  quoteDetails: {
    amount: number;
    details: string;
    valid_until: string;
    terms?: string;
  },
  request?: Request
): Promise<QuoteRecord> {
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

    const response = await fetch(`${baseUrl}/api/support/quotes/${quoteId}/submit`, {
      method: "POST",
      headers,
      body: JSON.stringify(quoteDetails),
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const quotedQuote = await response.json();
    return quotedQuote;
  } catch (error) {
    console.error("Erreur lors de la soumission du devis:", error);
    throw error;
  }
}

/**
 * Accepter/Rejeter un devis côté client
 */
export async function respondToQuote(
  quoteId: string,
  response: 'accept' | 'reject',
  feedback?: string,
  request?: Request
): Promise<QuoteRecord> {
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

    const response_fetch = await fetch(`${baseUrl}/api/support/quotes/${quoteId}/respond`, {
      method: "POST",
      headers,
      body: JSON.stringify({ response, feedback }),
    });

    if (!response_fetch.ok) {
      throw new Error(`Erreur HTTP: ${response_fetch.status}`);
    }

    const respondedQuote = await response_fetch.json();
    return respondedQuote;
  } catch (error) {
    console.error("Erreur lors de la réponse au devis:", error);
    throw error;
  }
}
