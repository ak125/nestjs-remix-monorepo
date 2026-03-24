/**
 * RagData — Type unique pour les données RAG gamme parsées depuis le frontmatter YAML.
 *
 * Source unique de vérité. Importé par :
 * - r1-image-prompt-builders (prompts image)
 * - r1-image-prompt.service (génération)
 * - r1-related-resources.service (maillage contextuel)
 * - rag-gamme-reader.service (parsing)
 *
 * Structure alignée avec .spec/00-canon/gamme-md-schema.md (v4)
 */

export interface RagData {
  category?: string;
  completeness_profile?: string; // filtration, freinage, electrique, etc.
  meta?: {
    completeness_profile?: string; // alias (certains fichiers le mettent dans meta)
  };
  domain?: {
    role?: string;
    confusion_with?: Array<{ term: string; difference: string }>;
    related_parts?: string[];
    norms?: string[];
    cross_gammes?: Array<{
      slug: string;
      relation: string;
      context?: string;
    }>;
  };
  selection?: {
    criteria?: string[];
    anti_mistakes?: string[];
    cost_range?: {
      min?: number;
      max?: number;
      currency?: string;
      note?: string;
    };
    brands?: {
      premium?: string[];
      standard?: string[];
      budget?: string[];
    };
    quality_tiers?: Array<{
      tier: string;
      description: string;
      price_range?: string;
    }>;
  };
  diagnostic?: {
    symptoms?: Array<{ id: string; label: string; severity: string }>;
    causes?: string[];
    depose_steps?: string[];
  };
  maintenance?: {
    wear_signs?: string[];
    interval?: string | { value?: string; unit?: string; note?: string };
  };
  installation?: {
    difficulty?: string;
    tools?: string[];
    steps?: string[];
    time?: string;
    prerequisite?: string;
  };

  // ── Modules conditionnels (racine, alignés schéma v4) ──

  /** Types/variantes de la pièce — consommé par TYPES builder */
  variants?: Array<{
    name: string;
    aliases?: string[];
    visual_differences?: string[];
    functional_differences?: string[];
  }>;

  /** Localisation sur le véhicule — consommé par LOCATION builder */
  location_on_vehicle?: {
    area?: string;
    access?: string;
    adjacent_parts?: string[];
  };

  /** Caractéristiques visuelles d'identification — consommé par image builders */
  key_visual_features?: {
    identifying_shapes?: string[];
    identifying_materials?: string[];
  };

  /** Cluster SEO — consommé par KP et meta */
  seo_cluster?: {
    primary_keyword?: { text?: string; volume?: number };
    keyword_variants?: Array<{ keyword: string; volume?: number }>;
    paa_questions?: string[];
  };
}
