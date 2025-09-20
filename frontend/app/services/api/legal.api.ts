/**
 * Service Legal API - Interface avec le backend NestJS LegalService
 * Compatible avec le LegalService adapté utilisant les tables existantes
 */

export interface LegalPage {
  msg_id: string;
  id: string;
  type: 'terms' | 'privacy' | 'cookies' | 'gdpr' | 'returns' | 'shipping' | 'warranty' | 'custom';
  title: string;
  content: string;
  version: string;
  effectiveDate: string;
  lastUpdated: string;
  published: boolean;
  language: string;
  slug: string;
  metadata?: Record<string, any>;
  createdBy: string;
  updatedBy?: string;
}

export interface LegalAcceptance {
  id: string;
  userId: string;
  documentId: string;
  version: string;
  acceptedAt: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface LegalPageVersion {
  id: string;
  documentId: string;
  version: string;
  content: string;
  changes: string;
  effectiveDate: string;
  createdAt: string;
}

// Mapping des clés de pages légales compatibles avec le backend
const PAGE_MAPPING = {
  cgv: 'terms',
  'conditions-generales-vente': 'terms',
  'charte-protection-utilisateur-consommateur': 'privacy',
  'conditions-utilisation': 'terms',
  'garanties-conformite-retour-garanties': 'warranty',
  livraison: 'shipping',
  'mentions-legales': 'terms',
  'paiement-securise': 'terms',
  reclamations: 'returns',
  'qui-sommes-nous': 'custom',
  'politique-confidentialite': 'privacy',
  'politique-cookies': 'cookies',
  gdpr: 'gdpr',
  retours: 'returns',
} as const;

/**
 * Récupérer une page légale
 */
export async function getLegalPage(
  pageKey: string,
  options: {
    version?: string;
    language?: string;
  } = {},
  request?: Request
): Promise<LegalPage> {
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
  
  try {
    // Mapper la clé si nécessaire
    const mappedKey = PAGE_MAPPING[pageKey as keyof typeof PAGE_MAPPING] || pageKey;
    
    // Construire les paramètres de requête
    const searchParams = new URLSearchParams();
    if (options.version) {
      searchParams.append('version', options.version);
    }
    if (options.language) {
      searchParams.append('language', options.language);
    }
    
    const queryString = searchParams.toString() ? `?${searchParams.toString()}` : '';
    
    // Préparer les headers
    const headers: HeadersInit = {
      Accept: "application/json",
    };

    // Transmission des cookies si disponibles
    if (request) {
      const cookie = request.headers.get("Cookie");
      if (cookie) {
        headers.Cookie = cookie;
      }
    }

    const response = await fetch(
      `${baseUrl}/api/support/legal/${mappedKey}${queryString}`,
      {
        method: "GET",
        headers,
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Page légale "${pageKey}" non trouvée`);
      }
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const result = await response.json();
    
    return {
      msg_id: result.msg_id,
      id: result.id,
      type: result.type,
      title: result.title,
      content: result.content,
      version: result.version,
      effectiveDate: result.effectiveDate,
      lastUpdated: result.lastUpdated,
      published: result.published,
      language: result.language || 'fr',
      slug: result.slug || pageKey,
      metadata: result.metadata,
      createdBy: result.createdBy,
      updatedBy: result.updatedBy,
    };
  } catch (error) {
    console.error(`Erreur lors de la récupération de la page légale "${pageKey}":`, error);
    throw error;
  }
}

/**
 * Récupérer toutes les pages légales disponibles
 */
export async function getAllLegalPages(
  options: {
    language?: string;
    published?: boolean;
  } = {},
  request?: Request
): Promise<LegalPage[]> {
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
  
  try {
    const searchParams = new URLSearchParams();
    if (options.language) {
      searchParams.append('language', options.language);
    }
    if (options.published !== undefined) {
      searchParams.append('published', options.published.toString());
    }
    
    const queryString = searchParams.toString() ? `?${searchParams.toString()}` : '';
    
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
      `${baseUrl}/api/support/legal${queryString}`,
      {
        method: "GET",
        headers,
      }
    );

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const result = await response.json();
    return result.pages || [];
  } catch (error) {
    console.error("Erreur lors de la récupération des pages légales:", error);
    throw error;
  }
}

/**
 * Accepter une page légale (GDPR, CGV, etc.)
 */
export async function acceptLegalPage(
  pageKey: string,
  options: {
    userId?: string;
    version?: string;
    ipAddress?: string;
    userAgent?: string;
  } = {},
  request?: Request
): Promise<{ success: boolean; acceptance: LegalAcceptance }> {
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
  
  try {
    const mappedKey = PAGE_MAPPING[pageKey as keyof typeof PAGE_MAPPING] || pageKey;
    
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

    const payload = {
      userId: options.userId,
      version: options.version,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
    };

    const response = await fetch(
      `${baseUrl}/api/support/legal/${mappedKey}/accept`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Erreur HTTP: ${response.status}`);
    }

    const result = await response.json();
    
    return {
      success: true,
      acceptance: result.acceptance
    };
  } catch (error) {
    console.error(`Erreur lors de l'acceptation de la page légale "${pageKey}":`, error);
    throw error;
  }
}

/**
 * Vérifier si un utilisateur a accepté une page légale
 */
export async function hasAcceptedLegalPage(
  pageKey: string,
  userId: string,
  request?: Request
): Promise<boolean> {
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
  
  try {
    const mappedKey = PAGE_MAPPING[pageKey as keyof typeof PAGE_MAPPING] || pageKey;
    
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
      `${baseUrl}/api/support/legal/${mappedKey}/acceptance/${userId}`,
      {
        method: "GET",
        headers,
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return false;
      }
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const result = await response.json();
    return result.accepted || false;
  } catch (error) {
    console.error(`Erreur lors de la vérification d'acceptation "${pageKey}":`, error);
    return false;
  }
}

/**
 * Récupérer l'historique des versions d'une page légale
 */
export async function getLegalPageVersions(
  pageKey: string,
  request?: Request
): Promise<LegalPageVersion[]> {
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
  
  try {
    const mappedKey = PAGE_MAPPING[pageKey as keyof typeof PAGE_MAPPING] || pageKey;
    
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
      `${baseUrl}/api/support/legal/${mappedKey}/versions`,
      {
        method: "GET",
        headers,
      }
    );

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const result = await response.json();
    return result.versions || [];
  } catch (error) {
    console.error(`Erreur lors de la récupération des versions "${pageKey}":`, error);
    throw error;
  }
}

/**
 * Télécharger une page légale en PDF
 */
export async function downloadLegalPagePDF(
  pageKey: string,
  options: {
    version?: string;
    language?: string;
  } = {},
  request?: Request
): Promise<Blob> {
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
  
  try {
    const mappedKey = PAGE_MAPPING[pageKey as keyof typeof PAGE_MAPPING] || pageKey;
    
    const searchParams = new URLSearchParams();
    if (options.version) {
      searchParams.append('version', options.version);
    }
    if (options.language) {
      searchParams.append('language', options.language);
    }
    
    const queryString = searchParams.toString() ? `?${searchParams.toString()}` : '';
    
    const headers: HeadersInit = {
      Accept: "application/pdf",
    };

    if (request) {
      const cookie = request.headers.get("Cookie");
      if (cookie) {
        headers.Cookie = cookie;
      }
    }

    const response = await fetch(
      `${baseUrl}/api/support/legal/${mappedKey}/pdf${queryString}`,
      {
        method: "GET",
        headers,
      }
    );

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    return await response.blob();
  } catch (error) {
    console.error(`Erreur lors du téléchargement PDF "${pageKey}":`, error);
    throw error;
  }
}

export const legalApi = {
  getLegalPage,
  getAllLegalPages,
  acceptLegalPage,
  hasAcceptedLegalPage,
  getLegalPageVersions,
  downloadLegalPagePDF,
};
