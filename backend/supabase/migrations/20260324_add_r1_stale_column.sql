-- P2.7: Colonne stale pour détecter obsolescence RAG
ALTER TABLE __seo_r1_image_prompts
ADD COLUMN IF NOT EXISTS rip_stale BOOLEAN DEFAULT false;

COMMENT ON COLUMN __seo_r1_image_prompts.rip_stale IS
  'P2.7 — true quand le contexte RAG a changé depuis la génération du prompt';
