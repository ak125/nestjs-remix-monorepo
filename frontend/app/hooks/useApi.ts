import { useState, useCallback } from "react";
import { type z } from "zod";
import { useNotifications } from "~/components/notifications/NotificationContainer";
import { logger } from "~/utils/logger";

interface ApiOptions {
  showLoading?: boolean;
  showNotifications?: boolean;
  cacheKey?: string;
}

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
}

export const useApi = <T extends z.ZodSchema>(responseSchema?: T) => {
  const [response, setResponse] = useState<
    ApiResponse<T extends z.ZodSchema ? z.infer<T> : any>
  >({
    data: null,
    error: null,
    isLoading: false,
  });

  const { showError, showSuccess } = useNotifications();

  const makeRequest = useCallback(
    async (url: string, options: RequestInit & ApiOptions = {}) => {
      const {
        showLoading = true,
        showNotifications = true,
        cacheKey: _,
        ...fetchOptions
      } = options;

      try {
        if (showLoading) {
          setResponse((prev) => ({ ...prev, isLoading: true, error: null }));
        }

        const response = await fetch(url, {
          headers: {
            "Content-Type": "application/json",
            ...fetchOptions.headers,
          },
          ...fetchOptions,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const rawData = await response.json();

        // Validation avec Zod si un schéma est fourni
        let validatedData = rawData;
        if (responseSchema) {
          const validation = responseSchema.safeParse(rawData);
          if (!validation.success) {
            logger.warn("API Response validation failed:", validation.error);
            if (showNotifications) {
              showError("Données reçues invalides");
            }
          } else {
            validatedData = validation.data;
          }
        }

        setResponse({
          data: validatedData,
          error: null,
          isLoading: false,
        });

        if (showNotifications && fetchOptions.method !== "GET") {
          showSuccess("Opération réussie");
        }

        return validatedData;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Erreur inconnue";

        setResponse({
          data: null,
          error: errorMessage,
          isLoading: false,
        });

        if (showNotifications) {
          showError(`Erreur: ${errorMessage}`);
        }

        throw error;
      } finally {
        if (showLoading) {
          setResponse((prev) => ({ ...prev, isLoading: false }));
        }
      }
    },
    [responseSchema, showError, showSuccess],
  );

  const get = useCallback(
    (url: string, options: ApiOptions = {}) => {
      return makeRequest(url, { ...options, method: "GET" });
    },
    [makeRequest],
  );

  const post = useCallback(
    (url: string, data: any, options: ApiOptions = {}) => {
      return makeRequest(url, {
        ...options,
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    [makeRequest],
  );

  const put = useCallback(
    (url: string, data: any, options: ApiOptions = {}) => {
      return makeRequest(url, {
        ...options,
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    [makeRequest],
  );

  const del = useCallback(
    (url: string, options: ApiOptions = {}) => {
      return makeRequest(url, { ...options, method: "DELETE" });
    },
    [makeRequest],
  );

  return {
    ...response,
    get,
    post,
    put,
    delete: del,
    makeRequest,
  };
};

// Hook spécialisé pour les opérations CRUD
export const useCrud = <T extends z.ZodSchema>(baseUrl: string, schema?: T) => {
  const api = useApi(schema);

  return {
    ...api,
    list: (params?: Record<string, any>) => {
      const queryString = params
        ? "?" + new URLSearchParams(params).toString()
        : "";
      return api.get(`${baseUrl}${queryString}`);
    },
    getById: (id: string | number) => api.get(`${baseUrl}/${id}`),
    create: (data: any) => api.post(baseUrl, data),
    update: (id: string | number, data: any) =>
      api.put(`${baseUrl}/${id}`, data),
    delete: (id: string | number) => api.delete(`${baseUrl}/${id}`),
  };
};
