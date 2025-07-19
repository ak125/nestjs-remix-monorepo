/**
 * Hooks React pour les appels API
 * Simplifie l'utilisation du client API avec gestion d'état intégrée
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient, type ApiResponse, type PaginatedResponse } from '~/lib/api-client';

// Hook générique pour les appels API
export function useApi<T>(
  apiCall: () => Promise<T>,
  dependencies: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiCall();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, dependencies);

  useEffect(() => {
    execute();
  }, [execute]);

  return { data, loading, error, refetch: execute };
}

// === HOOKS USERS ===

export function useUsers(params?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  return useApi(
    () => apiClient.getUsers(params),
    [params?.page, params?.limit, params?.search]
  );
}

export function useActiveUsers(params?: {
  page?: number;
  limit?: number;
}) {
  return useApi(
    () => apiClient.getActiveUsers(params),
    [params?.page, params?.limit]
  );
}

export function useUsersByLevel(level: number) {
  return useApi(
    () => apiClient.getUsersByLevel(level),
    [level]
  );
}

export function useUser(userId: string) {
  return useApi(
    () => apiClient.getUser(userId),
    [userId]
  );
}

export function useUserByEmail(email: string) {
  return useApi(
    () => apiClient.getUserByEmail(email),
    [email]
  );
}

export function useUserProfile(userId: string) {
  return useApi(
    () => apiClient.getUserProfile(userId),
    [userId]
  );
}

export function useUserActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createUser = async (userData: any) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.createUser(userData);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur création utilisateur');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (userId: string, userData: any) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.updateUser(userId, userData);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur mise à jour utilisateur');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateUserLevel = async (userId: string, level: number) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.updateUserLevel(userId, level);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur mise à jour niveau');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deactivateUser = async (userId: string, reason?: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.deactivateUser(userId, reason);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur désactivation utilisateur');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const activateUser = async (userId: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.activateUser(userId);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur activation utilisateur');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    createUser,
    updateUser,
    updateUserLevel,
    deactivateUser,
    activateUser,
    loading,
    error,
  };
}

// === HOOKS ORDERS ===

export function useOrders(params?: {
  page?: number;
  limit?: number;
  customerId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  return useApi(
    () => apiClient.getOrders(params),
    [params?.page, params?.limit, params?.customerId, params?.status, params?.dateFrom, params?.dateTo]
  );
}

export function useOrder(orderId: string) {
  return useApi(
    () => apiClient.getOrder(orderId),
    [orderId]
  );
}

export function useOrderComplete(orderId: string) {
  return useApi(
    () => apiClient.getOrderComplete(orderId),
    [orderId]
  );
}

export function useOrdersByCustomer(customerId: string) {
  return useApi(
    () => apiClient.getOrdersByCustomer(customerId),
    [customerId]
  );
}

export function useOrderActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateOrderStatus = async (orderId: string, status: string, reason?: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.updateOrderStatus(orderId, status, reason);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur mise à jour statut');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    updateOrderStatus,
    loading,
    error,
  };
}

// === HOOKS AUTOMOTIVE ===

export function useAutomotiveOrder(orderId: string) {
  return useApi(
    () => apiClient.getAutomotiveOrder(orderId),
    [orderId]
  );
}

export function useAutomotiveActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createAutomotiveOrder = async (orderData: any) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.createAutomotiveOrder(orderData);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur création commande automobile');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateAutomotiveOrderStatus = async (orderId: string, status: string, reason?: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.updateAutomotiveOrderStatus(orderId, status, reason);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur mise à jour statut automobile');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const validateVehicleData = async (orderId: string, vehicleData: any) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.validateVehicleData(orderId, vehicleData);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur validation véhicule');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    createAutomotiveOrder,
    updateAutomotiveOrderStatus,
    validateVehicleData,
    loading,
    error,
  };
}

// === HOOKS VEHICLE DATA ===

export function useVehicleValidation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateVIN = async (vin: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.validateVIN(vin);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur validation VIN');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const validateRegistration = async (registration: string, country = 'FR') => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.validateRegistration(registration, country);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur validation immatriculation');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const findEquivalentParts = async (oemCode: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.findEquivalentParts(oemCode);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur recherche équivalences');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    validateVIN,
    validateRegistration,
    findEquivalentParts,
    loading,
    error,
  };
}

// === HOOKS CALCULATIONS ===

export function useCalculations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateOrderTax = async (taxData: any) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.calculateOrderTax(taxData);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur calcul taxes');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const calculateShippingFee = async (shippingData: any) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.calculateShippingFee(shippingData);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur calcul livraison');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    calculateOrderTax,
    calculateShippingFee,
    loading,
    error,
  };
}

// === HOOKS SEARCH ===

export function useAutomotiveSearch(filters: {
  customerId?: string;
  hasVehicleData?: boolean;
  vinNumber?: string;
  registrationNumber?: string;
  oemCode?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  return useApi(
    () => apiClient.searchAutomotiveOrders(filters),
    [
      filters.customerId,
      filters.hasVehicleData,
      filters.vinNumber,
      filters.registrationNumber,
      filters.oemCode,
      filters.dateFrom,
      filters.dateTo,
      filters.status,
      filters.page,
      filters.limit,
    ]
  );
}

// === HOOKS AUTHENTICATION ===

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.login(email, password);
      setUser(result.user);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur connexion');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData: any) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.register(userData);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inscription');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      setError(null);
      await apiClient.logout();
      setUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur déconnexion');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (userData: any) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.updateProfile(userData);
      setUser(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur mise à jour profil');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.getProfile();
      setUser(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur récupération profil');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    login,
    register,
    logout,
    updateProfile,
    getProfile,
    loading,
    error,
    isAuthenticated: !!user,
  };
}
