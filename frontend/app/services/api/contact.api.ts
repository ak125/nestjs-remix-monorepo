/**
 * Service Contact API - Interface avec le backend NestJS ContactService
 * Compatible avec le ContactService adapté utilisant les tables existantes
 * Version mise à jour pour la compatibilité complète
 */

export interface ContactFormData {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  category: 'general' | 'technical' | 'billing' | 'complaint' | 'suggestion';
  vehicle_info?: {
    brand?: string;
    model?: string;
    year?: number;
    license_plate?: string;
  };
  order_number?: string;
  customer_id?: string;
}

export interface ContactTicket {
  msg_id: string;
  msg_cst_id: string;
  msg_cnfa_id?: string;
  msg_ord_id?: string;
  msg_date: string;
  msg_subject: string;
  msg_content: string;
  msg_parent_id?: string;
  msg_open: '0' | '1';
  msg_close: '0' | '1';
  priority?: string;
  category?: string;
  customer?: {
    cst_name: string;
    cst_fname: string;
    cst_mail: string;
    cst_phone: string;
  };
}

export interface ContactTicketWithStatus extends ContactTicket {
  status: 'open' | 'closed';
  lastUpdate: string;
  responseCount: number;
  assignedTo?: string;
}

export interface ContactStats {
  total_tickets: number;
  open_tickets: number;
  closed_tickets: number;
  tickets_last_24h: number;
}

/**
 * Créer un nouveau ticket de support
 */
export async function createContact(
  contactData: ContactFormData,
  request?: Request
): Promise<ContactTicket> {
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
  
  try {
    // Préparer les headers
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    // Transmission des cookies d'authentification si disponibles
    if (request) {
      const cookie = request.headers.get("Cookie");
      if (cookie) {
        headers.Cookie = cookie;
      }
    }

    const response = await fetch(`${baseUrl}/api/support/contact`, {
      method: "POST",
      headers,
      body: JSON.stringify(contactData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur HTTP ${response.status}: ${errorText}`);
    }

    const ticket = await response.json();
    return ticket;
  } catch (error) {
    console.error("Erreur lors de la création du ticket:", error);
    throw error;
  }
}

/**
 * Récupérer un ticket par son ID
 */
export async function getTicket(
  ticketId: string,
  request?: Request
): Promise<ContactTicket> {
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

    const response = await fetch(`${baseUrl}/api/support/contact/ticket/${ticketId}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const ticket = await response.json();
    return ticket;
  } catch (error) {
    console.error("Erreur lors de la récupération du ticket:", error);
    throw error;
  }
}

/**
 * Récupérer tous les tickets
 */
export async function getAllTickets(
  options: {
    page?: number;
    limit?: number;
    status?: 'open' | 'closed' | 'all';
  } = {},
  request?: Request
): Promise<{
  tickets: ContactTicket[];
  total: number;
  page: number;
  limit: number;
}> {
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
  
  try {
    const searchParams = new URLSearchParams({
      page: (options.page || 1).toString(),
      limit: (options.limit || 10).toString(),
    });

    if (options.status && options.status !== 'all') {
      searchParams.append('status', options.status);
    }

    const headers: HeadersInit = {
      Accept: "application/json",
    };

    if (request) {
      const cookie = request.headers.get("Cookie");
      if (cookie) {
        headers.Cookie = cookie;
      }
    }

    const response = await fetch(`${baseUrl}/api/support/contact/tickets?${searchParams}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Erreur lors de la récupération des tickets:", error);
    throw error;
  }
}

/**
 * Récupérer les statistiques des tickets
 */
export async function getContactStats(
  request?: Request
): Promise<ContactStats> {
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

    const response = await fetch(`${baseUrl}/api/support/contact/stats`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const stats = await response.json();
    return stats;
  } catch (error) {
    console.error("Erreur lors de la récupération des statistiques:", error);
    throw error;
  }
}

/**
 * Mettre à jour le statut d'un ticket
 */
export async function updateTicketStatus(
  ticketId: string,
  status: 'open' | 'closed',
  request?: Request
): Promise<ContactTicket> {
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

    const response = await fetch(`${baseUrl}/api/support/contact/ticket/${ticketId}/status`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const ticket = await response.json();
    return ticket;
  } catch (error) {
    console.error("Erreur lors de la mise à jour du statut:", error);
    throw error;
  }
}

/**
 * Rechercher des tickets par critères
 */
export async function searchTickets(
  searchCriteria: {
    keyword?: string;
    customer_id?: string;
    priority?: string;
    category?: string;
    date_from?: string;
    date_to?: string;
  },
  options: {
    page?: number;
    limit?: number;
  } = {},
  request?: Request
): Promise<{
  tickets: ContactTicket[];
  total: number;
  page: number;
  limit: number;
}> {
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
  
  try {
    const searchParams = new URLSearchParams({
      page: (options.page || 1).toString(),
      limit: (options.limit || 10).toString(),
    });

    // Ajouter les critères de recherche
    Object.entries(searchCriteria).forEach(([key, value]) => {
      if (value) {
        searchParams.append(key, value);
      }
    });

    const headers: HeadersInit = {
      Accept: "application/json",
    };

    if (request) {
      const cookie = request.headers.get("Cookie");
      if (cookie) {
        headers.Cookie = cookie;
      }
    }

    const response = await fetch(`${baseUrl}/api/support/contact/search?${searchParams}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Erreur lors de la recherche de tickets:", error);
    throw error;
  }
}
