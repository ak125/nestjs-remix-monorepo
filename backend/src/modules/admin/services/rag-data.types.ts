/**
 * RagData — Type unique pour les données RAG gamme parsées depuis le frontmatter YAML.
 *
 * Source unique de vérité. Importé par :
 * - r1-image-prompt-builders (prompts image)
 * - r1-image-prompt.service (génération)
 * - r1-related-resources.service (maillage contextuel)
 * - rag-gamme-reader.service (parsing)
 */

export interface RagData {
  category?: string;
  domain?: {
    role?: string;
    confusion_with?: Array<{ term: string; difference: string }>;
    related_parts?: string[];
  };
  selection?: {
    criteria?: string[];
    cost_range?: { min: number; max: number; currency?: string };
    brands?: { premium?: string[]; standard?: string[] };
  };
  diagnostic?: {
    symptoms?: Array<{ id: string; label: string; severity: string }>;
    causes?: string[];
  };
  maintenance?: {
    wear_signs?: string[];
    interval?: string;
  };
  installation?: {
    difficulty?: string;
    tools?: string[];
    steps?: string[];
    time?: string;
    prerequisite?: string;
  };
}
