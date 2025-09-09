/**
 * Service Review API - Interface avec le backend ReviewService
 * Gestion des avis clients, évaluations et modération
 */

export interface ReviewFormData {
  customer_id: string;
  product_id?: string;
  order_id?: string;
  rating: 1 | 2 | 3 | 4 | 5;
  title: string;
  comment: string;
  anonymous?: boolean;
  verified_purchase?: boolean;
  photos?: string[];
}

export interface ReviewRecord {
  review_id: string;
  customer_id: string;
  product_id?: string;
  order_id?: string;
  rating: number;
  title: string;
  comment: string;
  anonymous: boolean;
  verified_purchase: boolean;
  photos?: string[];
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  helpful_count: number;
  response?: string;
  response_date?: string;
  customer?: {
    name: string;
    email: string;
  };
}

export interface ReviewStats {
  total_reviews: number;
  pending_reviews: number;
  approved_reviews: number;
  rejected_reviews: number;
  average_rating: number;
  rating_distribution: {
    '5': number;
    '4': number;
    '3': number;
    '2': number;
    '1': number;
  };
}

/**
 * Créer un nouvel avis
 */
export async function createReview(
  reviewData: ReviewFormData,
  request?: Request
): Promise<ReviewRecord> {
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

    const response = await fetch(`${baseUrl}/api/support/reviews`, {
      method: "POST",
      headers,
      body: JSON.stringify(reviewData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    return result.review;
  } catch (error) {
    console.error("Erreur lors de la création de l'avis:", error);
    throw error;
  }
}

/**
 * Récupérer un avis par son ID
 */
export async function getReview(
  reviewId: string,
  request?: Request
): Promise<ReviewRecord> {
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

    const response = await fetch(`${baseUrl}/api/support/reviews/review/${reviewId}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const review = await response.json();
    return review;
  } catch (error) {
    console.error("Erreur lors de la récupération de l'avis:", error);
    throw error;
  }
}

/**
 * Récupérer tous les avis avec pagination
 */
export async function getAllReviews(
  options: {
    page?: number;
    limit?: number;
    status?: 'pending' | 'approved' | 'rejected' | 'all';
    product_id?: string;
    rating?: number;
  } = {},
  request?: Request
): Promise<{
  reviews: ReviewRecord[];
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

    if (options.product_id) {
      searchParams.append('product_id', options.product_id);
    }

    if (options.rating) {
      searchParams.append('rating', options.rating.toString());
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

    const response = await fetch(`${baseUrl}/api/support/reviews?${searchParams}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Erreur lors de la récupération des avis:", error);
    throw error;
  }
}

/**
 * Récupérer les statistiques des avis
 */
export async function getReviewStats(
  request?: Request
): Promise<ReviewStats> {
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

    const response = await fetch(`${baseUrl}/api/support/reviews/stats`, {
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
 * Modérer un avis (approuver/rejeter)
 */
export async function moderateReview(
  reviewId: string,
  action: 'approve' | 'reject',
  adminResponse?: string,
  request?: Request
): Promise<ReviewRecord> {
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

    const response = await fetch(`${baseUrl}/api/support/reviews/review/${reviewId}/moderate`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ action, admin_response: adminResponse }),
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const result = await response.json();
    return result.review;
  } catch (error) {
    console.error("Erreur lors de la modération:", error);
    throw error;
  }
}

/**
 * Rechercher des avis par critères
 */
export async function searchReviews(
  searchCriteria: {
    keyword?: string;
    rating?: number;
    customer_id?: string;
    product_id?: string;
    date_from?: string;
    date_to?: string;
  },
  options: {
    page?: number;
    limit?: number;
  } = {},
  request?: Request
): Promise<{
  reviews: ReviewRecord[];
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
        searchParams.append(key, value.toString());
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

    const response = await fetch(`${baseUrl}/api/support/reviews/search?${searchParams}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Erreur lors de la recherche d'avis:", error);
    throw error;
  }
}

/**
 * Récupérer les avis d'un produit
 */
export async function getProductReviews(
  productId: string,
  options: {
    page?: number;
    limit?: number;
    status?: 'pending' | 'approved' | 'rejected' | 'all';
  } = {},
  request?: Request
): Promise<{
  reviews: ReviewRecord[];
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

    const response = await fetch(`${baseUrl}/api/support/reviews/product/${productId}?${searchParams}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Erreur lors de la récupération des avis du produit:", error);
    throw error;
  }
}

/**
 * Récupérer les avis d'un client
 */
export async function getCustomerReviews(
  customerId: string,
  options: {
    page?: number;
    limit?: number;
  } = {},
  request?: Request
): Promise<{
  reviews: ReviewRecord[];
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

    const headers: HeadersInit = {
      Accept: "application/json",
    };

    if (request) {
      const cookie = request.headers.get("Cookie");
      if (cookie) {
        headers.Cookie = cookie;
      }
    }

    const response = await fetch(`${baseUrl}/api/support/reviews/customer/${customerId}?${searchParams}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Erreur lors de la récupération des avis du client:", error);
    throw error;
  }
}

/**
 * Récupérer un avis par ID
 */
export async function getReviewById(
  reviewId: number,
  request?: Request
): Promise<any> {
  return getReview(reviewId.toString(), request);
}

/**
 * Modifier le statut d'un avis
 */
export async function updateReviewStatus(
  reviewId: number,
  status: 'pending' | 'approved' | 'rejected',
  request?: Request
): Promise<ReviewRecord> {
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

    const response = await fetch(`${baseUrl}/api/support/reviews/review/${reviewId}/status`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const updatedReview = await response.json();
    return updatedReview;
  } catch (error) {
    console.error("Erreur lors de la mise à jour du statut:", error);
    throw error;
  }
}

/**
 * Supprimer un avis
 */
export async function deleteReview(
  reviewId: number,
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

    const response = await fetch(`${baseUrl}/api/support/reviews/review/${reviewId}`, {
      method: "DELETE",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
  } catch (error) {
    console.error("Erreur lors de la suppression:", error);
    throw error;
  }
}
