/**
 * Service Contact API - Interface avec le backend NestJS ContactService
 * Compatible avec le ContactService adapté utilisant les tables existantes
 */

export interface ContactRequest {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  category: 'general' | 'technical' | 'billing' | 'complaint' | 'suggestion' | 'order' | 'product' | 'commercial' | 'other';
  priority?: 'urgent' | 'high' | 'normal' | 'low';
  customerId?: string;
  orderNumber?: string;
  vehicleInfo?: {
    brand?: string;
    model?: string;
    year?: number;
    licensePlate?: string;
  };
  ipAddress?: string | null;
  userAgent?: string | null;
  attachments?: File[];
}

export interface ContactResponse {
  success: boolean;
  ticketNumber: string;
  ticket: {
    msg_id: string;
    msg_subject: string;
    msg_date: string;
    status: 'open' | 'closed' | 'pending';
    priority: string;
    category: string;
  };
  message?: string;
  error?: string;
}

export interface ContactTicketStatus {
  msg_id: string;
  status: 'open' | 'closed' | 'pending';
  lastUpdate: string;
  responseCount: number;
  assignedTo?: string;
}

/**
 * Créer un nouveau ticket de support
 */
export async function createContact(
  contactData: ContactRequest,
  request?: Request
): Promise<ContactResponse> {
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

    // Préparer les données en respectant l'interface du ContactService
    const payload = {
      name: contactData.name,
      email: contactData.email,
      phone: contactData.phone,
      subject: contactData.subject,
      message: contactData.message,
      priority: contactData.priority || 'normal',
      category: contactData.category || 'general',
      vehicle_info: contactData.vehicleInfo,
      order_number: contactData.orderNumber,
      customer_id: contactData.customerId,
      // Métadonnées pour traçabilité
      metadata: {
        ip_address: contactData.ipAddress,
        user_agent: contactData.userAgent,
        created_via: 'web_form',
        form_version: '2.0'
      }
    };

    const response = await fetch(`${baseUrl}/api/support/contact`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Erreur HTTP: ${response.status}`);
    }

    const result = await response.json();
    
    return {
      success: true,
      ticketNumber: result.ticket.msg_id,
      ticket: {
        msg_id: result.ticket.msg_id,
        msg_subject: result.ticket.msg_subject,
        msg_date: result.ticket.msg_date,
        status: result.ticket.msg_open === '1' ? 'open' : 'closed',
        priority: result.ticket.priority || 'normal',
        category: result.ticket.category || 'general',
      },
      message: result.message
    };
  } catch (error) {
    console.error("Erreur lors de la création du ticket:", error);
    throw new Error(
      error instanceof Error 
        ? error.message 
        : "Une erreur est survenue lors de l'envoi du message"
    );
  }
}

/**
 * Récupérer le statut d'un ticket
 */
export async function getTicketStatus(
  ticketId: string,
  request?: Request
): Promise<ContactTicketStatus> {
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

    const response = await fetch(`${baseUrl}/api/support/contact/${ticketId}/status`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const result = await response.json();
    
    return {
      msg_id: result.msg_id,
      status: result.msg_open === '1' ? 'open' : 'closed',
      lastUpdate: result.msg_date,
      responseCount: result.responseCount || 0,
      assignedTo: result.assignedTo,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération du statut:", error);
    throw error;
  }
}

/**
 * Récupérer les tickets d'un utilisateur
 */
export async function getUserTickets(
  customerId: string,
  options: {
    page?: number;
    limit?: number;
    status?: 'open' | 'closed' | 'all';
  } = {},
  request?: Request
): Promise<{
  tickets: ContactTicketStatus[];
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

    const response = await fetch(
      `${baseUrl}/api/support/contact/customer/${customerId}?${searchParams}`,
      {
        method: "GET",
        headers,
      }
    );

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const result = await response.json();
    
    return {
      tickets: result.tickets.map((ticket: any) => ({
        msg_id: ticket.msg_id,
        status: ticket.msg_open === '1' ? 'open' : 'closed',
        lastUpdate: ticket.msg_date,
        responseCount: ticket.responseCount || 0,
        assignedTo: ticket.assignedTo,
      })),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération des tickets:", error);
    throw error;
  }
}

/**
 * Uploader des fichiers pour un ticket
 */
export async function uploadTicketAttachments(
  ticketId: string,
  files: File[],
  request?: Request
): Promise<{ success: boolean; uploadedFiles: string[] }> {
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
  
  try {
    const formData = new FormData();
    files.forEach((file, index) => {
      formData.append(`file_${index}`, file);
    });
    formData.append('ticketId', ticketId);

    const headers: HeadersInit = {};

    if (request) {
      const cookie = request.headers.get("Cookie");
      if (cookie) {
        headers.Cookie = cookie;
      }
    }

    const response = await fetch(`${baseUrl}/api/support/contact/${ticketId}/upload`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const result = await response.json();
    
    return {
      success: true,
      uploadedFiles: result.uploadedFiles || []
    };
  } catch (error) {
    console.error("Erreur lors de l'upload:", error);
    throw error;
  }
}

export const contactApi = {
  createContact,
  getTicketStatus,
  getUserTickets,
  uploadTicketAttachments,
};
