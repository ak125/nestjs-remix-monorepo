import { useCallback, useState } from 'react';

export interface GenerateContentOptions {
  type: 'product_description' | 'seo_meta' | 'marketing_copy' | 'blog_article' | 'social_media' | 'email_campaign';
  prompt: string;
  tone?: 'professional' | 'casual' | 'friendly' | 'technical' | 'persuasive' | 'informative';
  language?: string;
  maxLength?: number;
  context?: Record<string, any>;
  temperature?: number;
  useCache?: boolean;
}

export interface ContentResponse {
  id: string;
  type: string;
  content: string;
  metadata: {
    generatedAt: string;
    cached: boolean;
    tokens?: number;
    model: string;
    language: string;
  };
}

export interface UseAiContentReturn {
  generateContent: (options: GenerateContentOptions) => Promise<ContentResponse>;
  generateProductDescription: (data: {
    productName: string;
    category?: string;
    features?: string[];
    specifications?: Record<string, any>;
    targetAudience?: string;
    tone?: string;
    language?: string;
    length?: 'short' | 'medium' | 'long';
  }) => Promise<ContentResponse>;
  generateSEOMeta: (data: {
    pageTitle: string;
    pageUrl?: string;
    keywords?: string[];
    targetKeyword?: string;
    businessType?: string;
    language?: string;
  }) => Promise<ContentResponse>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

export function useAiContent(): UseAiContentReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequest = async <T,>(
    endpoint: string,
    body: any,
  ): Promise<T> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/ai-content/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`,
        );
      }

      const data = await response.json();
      return data;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const generateContent = useCallback(
    async (options: GenerateContentOptions): Promise<ContentResponse> => {
      return handleRequest<ContentResponse>('generate', options);
    },
    [],
  );

  const generateProductDescription = useCallback(
    async (data: {
      productName: string;
      category?: string;
      features?: string[];
      specifications?: Record<string, any>;
      targetAudience?: string;
      tone?: string;
      language?: string;
      length?: 'short' | 'medium' | 'long';
    }): Promise<ContentResponse> => {
      return handleRequest<ContentResponse>('generate/product-description', data);
    },
    [],
  );

  const generateSEOMeta = useCallback(
    async (data: {
      pageTitle: string;
      pageUrl?: string;
      keywords?: string[];
      targetKeyword?: string;
      businessType?: string;
      language?: string;
    }): Promise<ContentResponse> => {
      return handleRequest<ContentResponse>('generate/seo-meta', data);
    },
    [],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    generateContent,
    generateProductDescription,
    generateSEOMeta,
    isLoading,
    error,
    clearError,
  };
}
