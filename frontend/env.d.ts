/**
 * Environment variable types for the frontend application
 */

declare global {
  interface Window {
    ENV?: {
      API_BASE_URL?: string;
      MEILISEARCH_URL?: string;
      NODE_ENV?: string;
      [key: string]: any;
    };
  }

  // Google Analytics gtag
  function gtag(...args: any[]): void;
}

export {};
