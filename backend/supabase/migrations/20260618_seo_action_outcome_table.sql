-- ============================================================================
-- PR-2 — Table d'outcomes matérialisés (boucle OBSERVE : … → MESURE 7/14/28 j)
-- ----------------------------------------------------------------------------
-- Snapshot IMMUABLE des deltas par (action, fenêtre). Pourquoi matérialiser plutôt
-- que calculer on-read (anti-bricolage) :
--   * GSC RÉVISE les jours récents → un calcul on-read dériverait ; un snapshot figé
--     une fois la fenêtre mûre est replay-proof ;
--   * l'accès anon de lecture lit UNIQUEMENT cette table projetée (jamais __admin_audit_log)
--     → la non-exposition du ledger admin est STRUCTURELLE (cf. CHECK-0 flag #2).
--
-- Pattern table : mirror RLS de __seo_quality_history (20260507) MAIS **NON partitionnée** :
-- volume = (nb actions attribuées × 3 fenêtres) = faible → la partition + sa rotation
-- seraient du sur-engineering et un risque de drift (incident snapshot-partition-rotation).
--
-- Idempotent (IF NOT EXISTS) + réversible (DOWN en pied).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.__seo_action_outcome (
  action_ref     UUID NOT NULL,                 -- = __admin_audit_log.aal_id de l'attribution
  page           TEXT NOT NULL,                 -- clé GSC absolue (DÉNORMALISÉE depuis la ligne audit)
  action_kind    TEXT NOT NULL,                 -- dénormalisé
  t0_utc         TIMESTAMPTZ NOT NULL,          -- ancre de mesure (applied_at_utc)
  window_days    INT NOT NULL CHECK (window_days IN (7, 14, 28)),
  is_complete    BOOLEAN NOT NULL,              -- fenêtre entièrement couverte par les données GSC ?
  expected_complete_date DATE,                  -- si pending : date à laquelle la fenêtre sera mesurable

  baseline_has_data BOOLEAN NOT NULL DEFAULT false,  -- baseline GSC non vide ? (sinon delta non fiable)

  -- métriques en FLOAT8 (supabase-js convertit NUMERIC → string ; FLOAT8 = number)
  baseline_daily_impr   FLOAT8,
  baseline_daily_clicks FLOAT8,
  baseline_daily_ctr    FLOAT8,                  -- ratio agrégé clics/impr sur la baseline
  baseline_daily_pos    FLOAT8,                  -- position moyenne pondérée impressions
  observed_daily_impr   FLOAT8,
  observed_daily_clicks FLOAT8,
  observed_daily_ctr    FLOAT8,
  observed_daily_pos    FLOAT8,
  delta_daily_impr      FLOAT8,                  -- observed - baseline (taux/jour)
  delta_daily_clicks    FLOAT8,
  delta_ctr             FLOAT8,
  delta_pos             FLOAT8,                  -- NÉGATIF = rang amélioré

  is_overlapped       BOOLEAN NOT NULL DEFAULT false,  -- autre action sur la même page chevauche
  confounding_actions TEXT[] NOT NULL DEFAULT '{}',    -- aal_id des actions chevauchantes
  data_lag_days       INT,                              -- lag GSC au moment de la mesure
  source              TEXT NOT NULL DEFAULT 'query_grain',   -- grain métrique (CHECK-0 : query → swap fidèle plus tard)
  causal_claim        TEXT NOT NULL DEFAULT 'OBSERVATIONAL', -- jamais causal
  measured_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (action_ref, window_days)          -- clé d'idempotence de l'UPSERT
);

COMMENT ON TABLE public.__seo_action_outcome IS
  'PR-2 boucle OBSERVE — outcomes SEO matérialisés (delta baseline vs fenêtre 7/14/28 j) par '
  'action attribuée. Snapshot immuable des fenêtres complètes + lignes pending. OBSERVATIONNEL, '
  'jamais causal. Table de lecture du RPC anon rpc_seo_action_outcomes_v1 (dénormalisée, sans '
  'exposer __admin_audit_log).';

CREATE INDEX IF NOT EXISTS idx_seo_action_outcome_page_t0
  ON public.__seo_action_outcome (page, t0_utc DESC);
CREATE INDEX IF NOT EXISTS idx_seo_action_outcome_t0
  ON public.__seo_action_outcome (t0_utc DESC);
CREATE INDEX IF NOT EXISTS idx_seo_action_outcome_kind
  ON public.__seo_action_outcome (action_kind, is_complete);

-- ----------------------------------------------------------------------------
-- RLS — pattern __seo_quality_history (service_role tout, authenticated lecture).
-- PAS de policy anon : l'accès anon se fait UNIQUEMENT via le RPC SECURITY DEFINER
-- rpc_seo_action_outcomes_v1 (projection contrôlée), jamais en SELECT direct.
-- ----------------------------------------------------------------------------
ALTER TABLE public.__seo_action_outcome ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all ON public.__seo_action_outcome; -- APPROVED: idempotent re-create of RLS policy
CREATE POLICY service_role_all ON public.__seo_action_outcome
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_read ON public.__seo_action_outcome; -- APPROVED: idempotent re-create of RLS policy
CREATE POLICY authenticated_read ON public.__seo_action_outcome
  FOR SELECT TO authenticated USING (true);

-- ============================================================================
-- DOWN (réversibilité — exécuter manuellement) :
--   DROP TABLE IF EXISTS public.__seo_action_outcome;
-- ============================================================================
