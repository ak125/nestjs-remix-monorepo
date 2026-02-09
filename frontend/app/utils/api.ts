/**
 * Configuration API centralisée pour éviter les URLs codées en dur
 * Utilise les variables d'environnement ou des valeurs par défaut
 */

import { logger } from "~/utils/logger";

// Configuration de l'API backend
export const API_CONFIG = {
  BASE_URL:
    typeof window !== "undefined" && window.ENV?.API_BASE_URL
      ? window.ENV.API_BASE_URL
      : "http://localhost:3000",
  ENDPOINTS: {
    // Endpoints des paiements - Backend consolidé
    PAYMENTS: "/api/payments",
    PAYMENT_BY_ID: (id: string) => `/api/payments/${id}`,
    PAYMENT_BY_REFERENCE: (ref: string) => `/api/payments/reference/${ref}`,
    PAYMENT_BY_USER: (userId: string) => `/api/payments/user/${userId}`,
    PAYMENT_BY_ORDER: (orderId: string) => `/api/payments/order/${orderId}`,
    PAYMENT_CANCEL: (id: string) => `/api/payments/${id}/cancel`,
    PAYMENT_REFUND: (id: string) => `/api/payments/${id}/refund`,
    PAYMENT_STATUS_UPDATE: (id: string) => `/api/payments/${id}/status`,
    PAYMENT_STATS: "/api/payments/stats",
    PAYMENT_METHODS: "/api/payments/methods/available",
    PAYMENT_CALLBACK: (gateway: string) => `/api/payments/callback/${gateway}`,
    PAYMENT_TRANSACTIONS: (id: string) => `/api/payments/${id}/transactions`,

    // Endpoints existants (pour compatibilité)
    ORDERS: "/api/orders",
    USERS: "/api/users",
  },
} as const;

/**
 * Construit une URL complète pour un endpoint
 */
export function buildApiUrl(endpoint: string): string {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
}

/**
 * Fonctions API pour les paiements - même pattern que users/orders
 * Utilisent le service NestJS direct ou fallback HTTP
 */

// Types pour les paiements - ALIGNÉS SUR LES VRAIES TABLES LEGACY
export interface LegacyPayment {
  id: number; // ord_id de ___xtr_order
  orderId: number; // ord_id
  customerId: number; // ord_cst_id (référence ___xtr_customer)
  // Nouvelles propriétés enrichies depuis ___xtr_customer
  customerName?: string; // cst_fname + cst_name combinés
  customerEmail?: string; // cst_mail
  customerCity?: string; // cst_city
  customerActive?: boolean; // cst_activ === '1'
  montantTotal: number; // ord_total_ttc
  devise: string; // stocké dans ord_info
  statutPaiement: string; // ord_is_pay ('0'=EN_ATTENTE, '1'=PAYE)
  methodePaiement: string; // stocké dans ord_info.payment_gateway
  referenceTransaction?: string; // stocké dans ord_info.transaction_id
  dateCreation: string; // ord_date
  datePaiement?: string; // ord_date_pay
}

// DTO pour créer un paiement - ALIGNÉ SUR CreateLegacyPaymentDto
export interface CreateLegacyPaymentRequest {
  ord_cst_id: string; // ID client (string comme attendu par l'API)
  ord_total_ttc: string; // Montant TTC (string comme attendu par l'API)
  ord_currency?: string; // Devise
  payment_gateway?: string; // Gateway (stocké dans ord_info)
  return_url?: string; // URL retour succès
  cancel_url?: string; // URL retour annulation
  callback_url?: string; // URL callback
  payment_metadata?: Record<string, unknown>; // Métadonnées
}

export interface PaymentStats {
  total_orders: number;
  paid_orders: number;
  pending_orders: number;
  total_amount: number;
  currency: string;
}

/**
 * Récupère les statistiques des paiements
 * Utilise le service direct ou fallback HTTP
 */
export async function getPaymentStats(context?: any): Promise<PaymentStats> {
  try {
    // Utilisation directe du service NestJS via le contexte (comme pour orders)
    if (context?.remixService?.integration) {
      logger.log("✅ Utilisation du service de paiements direct");
      // Note: il faudra ajouter getPaymentStatsForRemix au service d'intégration
      const result =
        await context.remixService.integration.getPaymentStatsForRemix?.();
      if (result?.success) {
        return result.stats;
      }
    }

    // Fallback : appel HTTP à notre propre API
    logger.log("⚠️ Fallback vers API HTTP pour les stats de paiement");
    const response = await fetch(
      buildApiUrl(API_CONFIG.ENDPOINTS.PAYMENT_STATS),
    );
    if (!response.ok) {
      throw new Error(`Erreur API: ${response.status} ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    logger.error(
      "❌ Erreur lors de la récupération des stats de paiement:",
      error,
    );
    // Retourner des stats par défaut en cas d'erreur
    return {
      total_orders: 0,
      paid_orders: 0,
      pending_orders: 0,
      total_amount: 0,
      currency: "EUR",
    };
  }
}

/**
 * Crée un nouveau paiement
 */
export async function createPayment(
  payment: CreateLegacyPaymentRequest,
  context?: any,
): Promise<LegacyPayment> {
  try {
    // Utilisation directe du service NestJS via le contexte
    if (context?.remixService?.integration) {
      logger.log("✅ Utilisation du service de paiements direct");
      const result =
        await context.remixService.integration.createPaymentForRemix?.(payment);
      if (result?.success) {
        return result.payment;
      }
    }

    // Fallback : appel HTTP
    logger.log("⚠️ Fallback vers API HTTP pour création de paiement");
    const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.PAYMENTS), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payment),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Erreur création paiement: ${response.status} - ${errorText}`,
      );
    }

    return response.json();
  } catch (error) {
    logger.error("❌ Erreur lors de la création du paiement:", error);
    throw error;
  }
}

/**
 * Vérifie le statut d'un paiement
 */
export async function getPaymentStatus(
  orderId: string | number,
  context?: any,
): Promise<LegacyPayment> {
  try {
    // Utilisation directe du service NestJS via le contexte
    if (context?.remixService?.integration) {
      logger.log("✅ Utilisation du service de paiements direct");
      const result =
        await context.remixService.integration.getPaymentStatusForRemix?.(
          orderId,
        );
      if (result?.success) {
        return result.payment;
      }
    }

    // Fallback : appel HTTP - Utiliser PAYMENT_BY_ORDER ou PAYMENT_BY_ID
    logger.log("⚠️ Fallback vers API HTTP pour statut de paiement");
    const response = await fetch(
      buildApiUrl(API_CONFIG.ENDPOINTS.PAYMENT_BY_ORDER(String(orderId))),
    );
    if (!response.ok) {
      throw new Error(`Paiement non trouvé: ${response.status}`);
    }
    return response.json();
  } catch (error) {
    logger.error(
      "❌ Erreur lors de la récupération du statut de paiement:",
      error,
    );
    throw error;
  }
}

/**
 * Parse JSON de manière sécurisée
 * Retourne l'objet parsé ou un objet avec le texte brut en cas d'erreur
 */
export function safeJsonParse(jsonString: string | null | undefined): unknown {
  if (!jsonString) return null;

  try {
    return JSON.parse(jsonString);
  } catch (e) {
    // Si ce n'est pas du JSON, retourner le texte brut
    return { rawText: jsonString };
  }
}
