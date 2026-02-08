/**
 * Service Claim API - Interface avec le backend ClaimService
 * Gestion des réclamations et litiges clients
 */

import { logger } from "~/utils/logger";

export interface ClaimFormData {
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  order_number?: string;
  product_name?: string;
  claim_type:
    | "defective_product"
    | "wrong_item"
    | "damaged_shipping"
    | "not_received"
    | "billing_issue"
    | "service_complaint"
    | "other";
  description: string;
  desired_resolution:
    | "refund"
    | "replacement"
    | "repair"
    | "compensation"
    | "apology"
    | "other";
  claim_amount?: number;
  incident_date?: string;
  evidence_photos?: string[];
  receipts?: string[];
  additional_documents?: string[];
}

export interface ClaimRecord {
  id: string;
  claim_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  order_number?: string;
  product_name?: string;
  claim_type: string;
  description: string;
  desired_resolution: string;
  claim_amount?: number;
  incident_date?: string;
  evidence_photos: string[];
  receipts: string[];
  additional_documents: string[];
  status:
    | "submitted"
    | "under_review"
    | "investigating"
    | "awaiting_info"
    | "resolved"
    | "rejected"
    | "closed";
  priority: "low" | "medium" | "high" | "critical";
  resolution?: string;
  resolution_amount?: number;
  resolution_date?: string;
  assigned_to?: string;
  escalated: boolean;
  escalation_reason?: string;
  escalated_at?: string;
  escalated_to?: string;
  created_at: string;
  updated_at: string;
  timeline: Array<{
    id: string;
    action: string;
    description: string;
    created_by: string;
    created_at: string;
    documents?: string[];
  }>;
  communications: Array<{
    id: string;
    type: "email" | "phone" | "internal_note" | "customer_update";
    content: string;
    from: string;
    to?: string;
    created_at: string;
    attachments?: string[];
  }>;
}

export interface ClaimStats {
  total_claims: number;
  submitted_claims: number;
  under_review_claims: number;
  resolved_claims: number;
  rejected_claims: number;
  average_resolution_time: number;
  customer_satisfaction: number;
  total_compensation: number;
  claims_by_type: Record<string, number>;
  resolution_rate: number;
  escalation_rate: number;
  claims_this_month: number;
  claims_last_month: number;
}

/**
 * Créer une nouvelle réclamation
 */
export async function createClaim(
  claimData: ClaimFormData,
  request?: Request,
): Promise<ClaimRecord> {
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

    const response = await fetch(`${baseUrl}/api/support/claims`, {
      method: "POST",
      headers,
      body: JSON.stringify(claimData),
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const newClaim = await response.json();
    return newClaim;
  } catch (error) {
    logger.error("Erreur lors de la création de la réclamation:", error);
    throw error;
  }
}

/**
 * Récupérer une réclamation par ID
 */
export async function getClaim(
  claimId: string,
  request?: Request,
): Promise<ClaimRecord> {
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

    const response = await fetch(`${baseUrl}/api/support/claims/${claimId}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const claim = await response.json();
    return claim;
  } catch (error) {
    logger.error("Erreur lors de la récupération de la réclamation:", error);
    throw error;
  }
}

/**
 * Récupérer toutes les réclamations avec pagination
 */
export async function getAllClaims(
  options: {
    page?: number;
    limit?: number;
    status?:
      | "submitted"
      | "under_review"
      | "investigating"
      | "awaiting_info"
      | "resolved"
      | "rejected"
      | "closed"
      | "all";
    priority?: "low" | "medium" | "high" | "critical" | "all";
    claim_type?: string;
    assigned_to?: string;
    escalated?: boolean;
    search?: string;
    date_from?: string;
    date_to?: string;
  } = {},
  request?: Request,
): Promise<{
  claims: ClaimRecord[];
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

    if (options.status && options.status !== "all")
      searchParams.append("status", options.status);
    if (options.priority && options.priority !== "all")
      searchParams.append("priority", options.priority);
    if (options.claim_type)
      searchParams.append("claim_type", options.claim_type);
    if (options.assigned_to)
      searchParams.append("assigned_to", options.assigned_to);
    if (options.escalated !== undefined)
      searchParams.append("escalated", options.escalated.toString());
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

    const response = await fetch(
      `${baseUrl}/api/support/claims?${searchParams}`,
      {
        method: "GET",
        headers,
      },
    );

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    logger.error("Erreur lors de la récupération des réclamations:", error);
    throw error;
  }
}

/**
 * Mettre à jour une réclamation
 */
export async function updateClaim(
  claimId: string,
  updateData: Partial<ClaimRecord>,
  request?: Request,
): Promise<ClaimRecord> {
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

    const response = await fetch(`${baseUrl}/api/support/claims/${claimId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const updatedClaim = await response.json();
    return updatedClaim;
  } catch (error) {
    logger.error("Erreur lors de la mise à jour de la réclamation:", error);
    throw error;
  }
}

/**
 * Récupérer les statistiques des réclamations
 */
export async function getClaimStats(request?: Request): Promise<ClaimStats> {
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

    const response = await fetch(`${baseUrl}/api/support/claims/stats`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const stats = await response.json();
    return stats;
  } catch (error) {
    logger.error(
      "Erreur lors de la récupération des stats réclamations:",
      error,
    );
    throw error;
  }
}

/**
 * Assigner une réclamation à un agent
 */
export async function assignClaim(
  claimId: string,
  agentId: string,
  request?: Request,
): Promise<ClaimRecord> {
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
      `${baseUrl}/api/support/claims/${claimId}/assign`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ assigned_to: agentId }),
      },
    );

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const assignedClaim = await response.json();
    return assignedClaim;
  } catch (error) {
    logger.error("Erreur lors de l'assignation de la réclamation:", error);
    throw error;
  }
}

/**
 * Escalader une réclamation
 */
export async function escalateClaim(
  claimId: string,
  escalationData: {
    reason: string;
    escalated_to: string;
    priority?: "high" | "critical";
  },
  request?: Request,
): Promise<ClaimRecord> {
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
      `${baseUrl}/api/support/claims/${claimId}/escalate`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(escalationData),
      },
    );

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const escalatedClaim = await response.json();
    return escalatedClaim;
  } catch (error) {
    logger.error("Erreur lors de l'escalade de la réclamation:", error);
    throw error;
  }
}

/**
 * Résoudre une réclamation
 */
export async function resolveClaim(
  claimId: string,
  resolutionData: {
    resolution: string;
    resolution_amount?: number;
    compensation_type?:
      | "refund"
      | "replacement"
      | "store_credit"
      | "discount"
      | "other";
    internal_notes?: string;
  },
  request?: Request,
): Promise<ClaimRecord> {
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
      `${baseUrl}/api/support/claims/${claimId}/resolve`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(resolutionData),
      },
    );

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const resolvedClaim = await response.json();
    return resolvedClaim;
  } catch (error) {
    logger.error("Erreur lors de la résolution de la réclamation:", error);
    throw error;
  }
}

/**
 * Ajouter une communication à une réclamation
 */
export async function addClaimCommunication(
  claimId: string,
  communicationData: {
    type: "email" | "phone" | "internal_note" | "customer_update";
    content: string;
    to?: string;
    attachments?: string[];
  },
  request?: Request,
): Promise<ClaimRecord> {
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
      `${baseUrl}/api/support/claims/${claimId}/communications`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(communicationData),
      },
    );

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const updatedClaim = await response.json();
    return updatedClaim;
  } catch (error) {
    logger.error("Erreur lors de l'ajout de la communication:", error);
    throw error;
  }
}

/**
 * Uploader des documents pour une réclamation
 */
export async function uploadClaimDocuments(
  claimId: string,
  files: File[],
  documentType: "evidence" | "receipt" | "additional",
  request?: Request,
): Promise<string[]> {
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";

  try {
    const formData = new FormData();
    files.forEach((file, index) => {
      formData.append(`files`, file);
    });
    formData.append("document_type", documentType);

    const headers: HeadersInit = {};

    if (request) {
      const cookie = request.headers.get("Cookie");
      if (cookie) {
        headers.Cookie = cookie;
      }
    }

    const response = await fetch(
      `${baseUrl}/api/support/claims/${claimId}/documents`,
      {
        method: "POST",
        headers,
        body: formData,
      },
    );

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const result = await response.json();
    return result.uploadedFiles || [];
  } catch (error) {
    logger.error("Erreur lors de l'upload des documents:", error);
    throw error;
  }
}
