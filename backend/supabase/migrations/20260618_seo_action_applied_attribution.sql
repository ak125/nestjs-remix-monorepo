-- squawk-ignore-file require-concurrent-index-creation
--   Plain CREATE INDEX (pas CONCURRENTLY) : __admin_audit_log ≈ 34 lignes → aucun bénéfice,
--   et CONCURRENTLY ne peut pas tourner en transaction (assume_in_transaction). Même
--   politique que 20260518_seo_control_003_indexes.sql.
set lock_timeout = '5s';
set statement_timeout = '60s';

-- ============================================================================
-- PR-1 — Attribution « seo_action_applied » (boucle OBSERVE : DATA → … → MESURE)
-- ----------------------------------------------------------------------------
-- AUCUNE table créée : on ÉTEND le ledger admin EXISTANT __admin_audit_log via un
-- namespace aal_action, exactement comme cc_orchestration_shadow_plan (ADR-087).
-- Jamais de table de ledger parallèle.
--
-- CHECK-0 (audit/seo-action-outcome-preflight-2026-06-18.md) :
--   * __admin_audit_log = table SIMPLE (non partitionnée), RLS ON (policy service_role_aal,
--     anon refusé au row-level) → un index partiel est sûr (zéro complexité partition).
--   * aal_action = VARCHAR libre (pas d'ENUM/CHECK) → 'seo_action_applied' accepté SANS DDL.
--   * volume ~0.5 ligne/j → index partiel < 1 Ko/an, zéro write-amplification.
--
-- Idempotent (IF NOT EXISTS) + réversible (section DOWN ci-dessous, à exécuter manuellement).
-- ============================================================================

-- Index partiel : retrouve les actions SEO attribuées par page + applied_at_utc,
-- pour la matérialisation des outcomes (PR-2).
CREATE INDEX IF NOT EXISTS idx_aal_seo_action_applied
  ON public.__admin_audit_log (aal_entity_id, ((aal_new_value ->> 'applied_at_utc')))
  WHERE aal_action = 'seo_action_applied';

COMMENT ON INDEX public.idx_aal_seo_action_applied IS
  'PR-1 boucle OBSERVE : lookup des actions SEO attribuées (namespace seo_action_applied) '
  'par page + applied_at_utc pour la matérialisation des outcomes (PR-2).';

-- ----------------------------------------------------------------------------
-- Schéma documenté du payload aal_new_value (seo_action_applied.v1) :
--   {
--     action_kind:          meta_rewrite | content_enrich | internal_link | regen_artifact | other,
--     applied_at_utc:       ISO-8601 « Z » (T0, ancre de mesure),
--     source_action_id:     text | null  (opportunité Command Center source, ou null = manuel),
--     baseline_window_days: int (défaut 28),
--     notes:                text | null
--   }
--   aal_entity_type = 'seo_page'
--   aal_entity_id   = URL ABSOLUE canonique (clé de jointure GSC, cf. gsc-page-key.ts)
--   aal_metadata    = { "schema": "seo_action_applied.v1" }
-- ----------------------------------------------------------------------------

-- ============================================================================
-- DOWN (réversibilité — exécuter manuellement pour annuler) :
--   DROP INDEX IF EXISTS public.idx_aal_seo_action_applied;
--   -- Les lignes d'attribution restent (ledger append-only) ; pour les retirer :
--   -- DELETE FROM public.__admin_audit_log WHERE aal_action = 'seo_action_applied';
-- ============================================================================
