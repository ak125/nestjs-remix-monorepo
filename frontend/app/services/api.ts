/**
 * 🌐 SERVICE API UNIFIÉ
 *
 * Service centralisé pour toutes les requêtes API
 * Utilise les types partagés du monorepo
 *
 * @version 2.0.0
 * @package frontend
 */

import { type ApiResponse } from "@repo/database-types";

// ====================================
// 🔧 CONFIGURATION API
// ====================================

const API_BASE_URL = "/api"; // Grâce au proxy Vite

/**
 * Configuration par défaut pour les requêtes fetch
 */
const defaultFetchOptions: RequestInit = {
  headers: {
    "Content-Type": "application/json",
  },
  credentials: "include", // Important pour les cookies de session
};

// ====================================
// 🛠️ FONCTIONS UTILITAIRES
// ====================================

/**
 * Fonction générique pour faire des requêtes API
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...defaultFetchOptions,
    ...options,
    headers: {
      ...defaultFetchOptions.headers,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// ====================================
// 📦 SERVICES SPÉCIALISÉS
// ====================================

/**
 * Service pour la gestion du panier
 */
export const cartApi = {
  /**
   * Récupère le panier de l'utilisateur
   */
  async getCart() {
    return apiRequest("/cart");
  },

  /**
   * Ajoute un produit au panier
   */
  async addItem(pieceId: number, quantity: number = 1) {
    return apiRequest("/cart/add", {
      method: "POST",
      body: JSON.stringify({ pieceId, quantity }),
    });
  },

  /**
   * Met à jour la quantité d'un produit
   */
  async updateQuantity(pieceId: number, quantity: number) {
    return apiRequest("/cart/update", {
      method: "PATCH",
      body: JSON.stringify({ pieceId, quantity }),
    });
  },

  /**
   * Supprime un produit du panier
   */
  async removeItem(pieceId: number) {
    return apiRequest(`/cart/remove/${pieceId}`, {
      method: "DELETE",
    });
  },

  /**
   * Vide complètement le panier
   */
  async clearCart() {
    return apiRequest("/cart", {
      method: "DELETE",
    });
  },
};

/**
 * Service pour les produits/pièces
 */
export const piecesApi = {
  /**
   * Récupère les détails d'une pièce
   */
  async getPiece(pieceId: number) {
    return apiRequest(`/pieces/${pieceId}`);
  },

  /**
   * Recherche de pièces
   */
  async searchPieces(query: string, filters?: Record<string, any>) {
    const searchParams = new URLSearchParams({ q: query });

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        searchParams.append(key, String(value));
      });
    }

    return apiRequest(`/pieces/search?${searchParams}`);
  },
};

/**
 * Service pour les véhicules
 */
export const vehiclesApi = {
  /**
   * Récupère les pièces compatibles avec un véhicule
   */
  async getCompatiblePieces(vehicleId: string) {
    return apiRequest(`/vehicles/${vehicleId}/pieces`);
  },

  /**
   * Récupère les détails d'un véhicule
   */
  async getVehicle(vehicleId: string) {
    return apiRequest(`/vehicles/${vehicleId}`);
  },
};

// ====================================
// 🔄 EXPORT UNIFIÉ
// ====================================

/**
 * API unifiée pour tout le frontend
 */
export const api = {
  cart: cartApi,
  pieces: piecesApi,
  vehicles: vehiclesApi,

  // Fonction générique pour des cas spéciaux
  request: apiRequest,
};

export default api;
