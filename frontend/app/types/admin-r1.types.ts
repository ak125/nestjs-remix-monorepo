/**
 * Types admin R1 partagés — source unique pour les interfaces admin.
 *
 * Utilisé par :
 * - admin.r1-images.tsx
 * - admin.r1-qa.tsx
 */

/** Ligne de prompt image R1 (miroir DB __seo_r1_image_prompts) */
export interface R1PromptRow {
  rip_id: number;
  rip_pg_id: number;
  rip_pg_alias: string;
  rip_gamme_name: string;
  rip_slot_id: string;
  rip_section_id: string;
  rip_prompt_text: string;
  rip_neg_prompt: string;
  rip_alt_text: string;
  rip_caption: string | null;
  rip_aspect_ratio: string;
  rip_image_url: string | null;
  rip_status: string;
  rip_selected: boolean;
  rip_priority_rank: number;
  rip_rag_fields_used: string[];
  rip_rag_richness_score: number;
  rip_stale: boolean;
}
