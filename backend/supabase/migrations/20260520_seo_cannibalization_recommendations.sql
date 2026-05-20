-- GSC Cannibalization Audit — table de recommandations (Phase audit, additive isolée)
-- Une row par page "perdante" d'un cluster de cannibalisation (requête disputée par >1 page).
-- status DEFAULT 'proposed' : AUCUNE action appliquée. Révision humaine requise avant tout
-- changement canonical/noindex (cf feedback_no_url_changes_ever + feedback_no_auto_page_suppression_ever).

CREATE TABLE IF NOT EXISTS __seo_cannibalization_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at timestamptz NOT NULL DEFAULT now(),
  -- Cluster (identifié par la requête Google)
  query text NOT NULL,
  cluster_pattern text NOT NULL,  -- 'intra_r2' | 'intra_r8' | 'r8_vs_r2' | 'mixed'
  competing_pages int NOT NULL,
  winner_page text NOT NULL,
  winner_position numeric(6,2) NOT NULL,
  cluster_clicks int NOT NULL DEFAULT 0,
  cluster_impressions int NOT NULL DEFAULT 0,
  -- Page concernée (le "loser" ou winner)
  page text NOT NULL,
  page_position numeric(6,2) NOT NULL,
  page_impressions int NOT NULL DEFAULT 0,
  page_clicks int NOT NULL DEFAULT 0,
  is_winner boolean NOT NULL DEFAULT false,
  -- Recommandation
  recommended_action text NOT NULL CHECK (recommended_action IN ('keep','differentiate','canonical_candidate','noindex_candidate')),
  confidence_level text NOT NULL CHECK (confidence_level IN ('HIGH','MEDIUM','LOW')),
  target_canonical_url text NULL,  -- pour canonical_candidate : pointe vers winner_page
  reason text NOT NULL,
  -- Workflow révision (jamais 'applied' par le script)
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','reviewed','approved','rejected','applied')),
  reviewed_by text NULL,
  applied_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_cannibal_reco_query ON __seo_cannibalization_recommendations (query, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_cannibal_reco_action ON __seo_cannibalization_recommendations (recommended_action, confidence_level);
CREATE INDEX IF NOT EXISTS idx_cannibal_reco_status ON __seo_cannibalization_recommendations (status, captured_at DESC);

COMMENT ON TABLE __seo_cannibalization_recommendations IS
  'GSC Cannibalization Audit : recommandations par page perdante (canonical/noindex/differentiate/keep). status proposed par défaut — JAMAIS appliqué auto. Source signal = __seo_gsc_daily (requêtes disputées par >1 page).';
