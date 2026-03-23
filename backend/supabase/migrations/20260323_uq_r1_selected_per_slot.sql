-- P1.2: Invariant — au plus 1 image selected=true par (page, slot)
-- Pré-check validé : 0 doublons (audit P0.1, 2026-03-23)
CREATE UNIQUE INDEX IF NOT EXISTS uq_r1_selected_per_page_slot
ON __seo_r1_image_prompts (rip_pg_id, rip_slot_id)
WHERE rip_selected = true;

COMMENT ON INDEX uq_r1_selected_per_page_slot IS
  'P1.2 — garantit max 1 image selected par slot/page. Voir P0 audit.';
