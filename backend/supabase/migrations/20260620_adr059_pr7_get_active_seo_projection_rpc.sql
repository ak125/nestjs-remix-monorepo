-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- ADR-059 PR-7 (read-surface) — RPC get_active_seo_projection (backend-proxied, service_role)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Canon : ADR-059 (SEO Runtime Projection). Lit les 2 MV de projection (créées PR-6,
--   20260619_adr059_pr6_seo_projection_schema.sql ; SELECT direct REVOQUÉ pour anon en PR-6c).
--
-- TOPOLOGIE (vérifiée) : le read-path R1/R8 est **backend-proxied**, PAS frontend-direct.
--   Le loader Remix → `fetch http://localhost:3000/api/...` → service NestJS → `callRpc(..., {source:'api'})`.
--   Le frontend n'appelle JAMAIS Supabase directement. Conséquence :
--     → cette RPC est appelée par le **service_role** (backend), donc **AUCUN GRANT anon** (≠ hypothèse
--       initiale ADR-059 qui supposait un appel frontend-direct). EXECUTE = service_role uniquement.
--     → le câblage `callRpc('get_active_seo_projection', …, {source:'api'})` + l'entrée rpc_allowlist.json
--       + l'overlay dans rm-builder (R1) / vehicle-rpc (R8) = PR-7b (touche les pages SEO live, flag-gated).
--
-- Cette migration = **surface de lecture DB seule** (dark) : la RPC existe + est testable, mais AUCUN
--   appelant tant que PR-7b n'est pas posée. Flag runtime `seo_projection_read_v1` OFF.
--
-- STABLE (pur SELECT, aucun effet de bord — pas de rebuild de cache → pas de VOLATILE requis).
-- SECURITY DEFINER + SET search_path=public : lit les MV en tant qu'owner (les MV sont REVOQUÉES anon),
--   défense en profondeur même si l'EXECUTE était un jour élargi. EXECUTE verrouillé service_role.
--
-- Risque : BAS — CREATE OR REPLACE idempotent, lecture seule, 0 donnée touchée. Réversible (DROP en pied).
--   NON auto-appliquée (deployment.md axe 4) : revue owner + apply manuel.
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Transaction gérée par l'outil de migration (assume_in_transaction=true). Timeouts requis :
SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE OR REPLACE FUNCTION public.get_active_seo_projection(
  p_entity_id text,
  p_role      text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Driven par l'entité (facts) : pas de fact-version active → 0 row → la RPC retourne NULL
  -- (= "pas de projection" → le caller fait son fallback, jamais de fabrication).
  SELECT jsonb_build_object(
    'entity_id',       f.entity_id,
    'entity_type',     f.entity_type,
    'slug',            f.slug,
    'content_hash',    f.content_hash,
    'confidence_base', f.confidence_base,
    'facts',           COALESCE(f.facts, '[]'::jsonb),
    'blocks',          COALESCE((
      SELECT jsonb_agg(
               jsonb_build_object(
                 'block_id',        b.block_id,
                 'role',            b.role,
                 'block_kind',      b.block_kind,
                 'content',         b.content,
                 'version_id',      b.version_id,
                 'content_hash',    b.content_hash,
                 'confidence_base', b.confidence_base,
                 'valid_from',      b.valid_from
               )
               ORDER BY b.role, b.block_kind
             )
      FROM mv_seo_content_blocks_current b
      WHERE b.entity_id = f.entity_id
        AND (p_role IS NULL OR b.role = p_role)
    ), '[]'::jsonb)
  )
  FROM mv_seo_entity_facts_current f
  WHERE f.entity_id = p_entity_id;
$$;

COMMENT ON FUNCTION public.get_active_seo_projection(text, text) IS
  'ADR-059 PR-7 — Lecture projection SEO active (facts + blocks role-aware) pour une entité. STABLE SECURITY DEFINER, service_role only (read-path backend-proxied). p_role optionnel filtre les blocks. Retourne NULL si entité non projetée (→ fallback caller).';

-- EXECUTE : service_role uniquement (backend). Retirer le grant PUBLIC implicite + les grants
-- default-privileges Supabase anon/authenticated (sinon anon pourrait appeler la RPC).
REVOKE ALL ON FUNCTION public.get_active_seo_projection(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_seo_projection(text, text) TO service_role;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- ROLLBACK (down) — réversible (lecture seule, aucune donnée touchée).
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BEGIN;
--   DROP FUNCTION IF EXISTS public.get_active_seo_projection(text, text);
-- COMMIT;
