// Composants d'erreur pour l'ErrorBoundary globale
export { Error401 } from "./Error401";
export { Error404 } from "./Error404";
export { Error410 } from "./Error410";
export { Error503 } from "./Error503";
export { ErrorGeneric } from "./ErrorGeneric";

// Types et interfaces
export interface ErrorComponentProps {
  url?: string;
  status?: number;
  message?: string;
  details?: string;
  suggestions?: string[];
}

export interface ErrorBoundaryData {
  url?: string;
  isOldLink?: boolean;
  condition?: string;
  requirement?: string;
  redirectTo?: string;
  suggestions?: string[];
  retryAfter?: number;
}
