-- =====================================================
-- @sellable-canon-authority : ce fichier EST l'autorité SQL du prédicat de vendabilité
--   (is_piece_sellable / refresh_catalog_sellable_candidates / catalog_sellable_diagnostic).
--   La garde scripts/lint/check-dispo-canon.sh l'exempte à ce titre (usages pri_dispo légitimes).
-- =====================================================
-- __catalog_sellable_candidates — vérité canonique de vendabilité (agrégat type×gamme)
-- PR1 du plan "Activation cohérente véhicule/gamme des réfs dispo" (2026-06-13).
--
-- ROLE : projection PRICING-AWARE (rollup) keyée (type_id_i, pg_id), consommée par
--   R2-en-masse / sitemap / sélecteurs / cohortes d'activation véhicule. Réutilise la
--   DISCIPLINE de matérialisation de refresh_gamme_aggregates (INSERT…SELECT + ON CONFLICT
--   upsert + refresh cron) — PAS son cost model (delta/stale/shard, JAMAIS de full sweep).
--
-- NON-MUTANT CATALOGUE : cette migration ne touche QUE des tables de projection internes
--   (__catalog_sellable_candidates, __catalog_sellable_meta). AUCUNE écriture sur pieces,
--   pieces_price, pieces_gamme, auto_type, sitemap, canonical, SEO runtime.
--
-- PRÉDICAT CANONIQUE UNIQUE (autorité SQL d'agrégat — voir SellabilityTruthService côté TS) :
--   pri_dispo IN ('1','2','3') AND pri_vente_ttc_n > 0  (price-sellable, par ligne prix)
--   piece "vendable-prix" = bool_or(ci-dessus) sur ses lignes prix, ET piece_display = true.
--   sellable = catalog_active (type/modele/marque/pg display) ∧ price-sellable ∧ piece_display.
--
-- DISPLAY ≠ INDEXABILITÉ : ce rollup ne stocke PAS d'indexability_verdict (la politique SEO
--   r2-indexability / #916 reste seule autorité du verdict et consomme sellable_count).
--
-- DÉCOMPOSITION anti-fan-out : catalog_active (chaîne display, recompute cheap sur flip
--   marque/modele/type/pg) vs price_sellable_count (recompute cher sur prix/piece_display).
--   sellable_count = colonne GENERATED STORED (cohérence auto, zéro divergence).
--
-- SCHÉMA public PINNÉ (hazard dual-schema : tecdoc_rebuild.pieces_relation_type = copie 2,2M).
--
-- ⚠️ NON appliquée automatiquement — apply owner-gated (migrations DB non auto-appliquées,
--   cf. deployment.md axe 4). Read-only vis-à-vis du catalogue → apply sans risque data.
--   Tant que __catalog_sellable_meta.ready = false → consommateurs OFF (gate de readiness).
--
-- ROLLBACK (fonctionnel) : UPDATE __catalog_sellable_meta SET ready=false → consommateurs
--   reviennent au comportement actuel. ROLLBACK (structurel) : voir bloc en fin de fichier.
-- =====================================================

set lock_timeout = '3s';
set statement_timeout = '120s';

-- ---------- 1. Table de contrôle / readiness (singleton) ----------
CREATE TABLE IF NOT EXISTS public.__catalog_sellable_meta (
  singleton             boolean PRIMARY KEY DEFAULT true,
  ready                 boolean NOT NULL DEFAULT false,
  backfill_completed_at timestamptz,
  note                  text,
  CONSTRAINT __catalog_sellable_meta_singleton_chk CHECK (singleton = true)
);

INSERT INTO public.__catalog_sellable_meta (singleton, ready, note)
VALUES (true, false, 'PR1 — backfill non exécuté ; consommateurs OFF')
ON CONFLICT (singleton) DO NOTHING;

COMMENT ON TABLE public.__catalog_sellable_meta IS
  'Singleton de readiness du rollup __catalog_sellable_candidates. ready=false → consommateurs (R2/sitemap/sélecteurs) gardent leur comportement actuel (pas de fallback silencieux sur table vide). Passé à true UNIQUEMENT après backfill initial complet + validé.';

-- ---------- 2. Rollup agrégat type×gamme ----------
CREATE TABLE IF NOT EXISTS public.__catalog_sellable_candidates (
  type_id_i            integer NOT NULL,   -- = auto_type.type_id_i / pieces_relation_type.rtp_type_id
  pg_id                integer NOT NULL,   -- = pieces_gamme.pg_id   / pieces_relation_type.rtp_pg_id
  catalog_active       boolean NOT NULL DEFAULT false,  -- type∧modele∧marque∧pg display (chaîne cheap)
  price_sellable_count integer NOT NULL DEFAULT 0,       -- pièces relation∧piece_display∧prix-vendable (part chère)
  -- vérité de gate : pièces PLEINEMENT vendables = catalog_active ? price_sellable_count : 0
  sellable_count       integer GENERATED ALWAYS AS
                         (CASE WHEN catalog_active THEN price_sellable_count ELSE 0 END) STORED,
  min_price            numeric,            -- min TTC sur pièces pleinement vendables (NULL si 0) — ordering listing only
  has_price            boolean NOT NULL DEFAULT false,   -- ≥1 ligne prix > 0 (diagnostic : priced-but-not-dispo)
  has_dispo            boolean NOT NULL DEFAULT false,   -- ≥1 ligne prix pri_dispo IN ('1','2','3')
  refreshed_at         timestamptz,        -- NULL = stale / jamais calculé (drainé par le worker stale)
  PRIMARY KEY (type_id_i, pg_id)
);

-- Gate filters (sellable_count >= seuil) + worker reconcile (refreshed_at NULLS FIRST).
CREATE INDEX IF NOT EXISTS idx_csc_sellable_count
  ON public.__catalog_sellable_candidates (sellable_count);
CREATE INDEX IF NOT EXISTS idx_csc_refreshed_at_nulls_first
  ON public.__catalog_sellable_candidates (refreshed_at NULLS FIRST);
CREATE INDEX IF NOT EXISTS idx_csc_pg_id
  ON public.__catalog_sellable_candidates (pg_id);

COMMENT ON TABLE public.__catalog_sellable_candidates IS
  'Projection pricing-aware (rollup) type×gamme de la vendabilité. PROJECTION, jamais une source de vérité — régénérable depuis pieces/pieces_price/pieces_relation_type via refresh_catalog_sellable_candidates(). Consommée par R2-en-masse/sitemap/sélecteurs/cohortes activation véhicule. Cart/prix lisent les tables source au niveau pièce (SellabilityTruthService), PAS cette table. sellable_count = GENERATED (catalog_active ? price_sellable_count : 0).';

-- ---------- 3. RLS (deny-all ; backend service_role bypass) ----------
ALTER TABLE public.__catalog_sellable_meta       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.__catalog_sellable_candidates ENABLE ROW LEVEL SECURITY;
-- Aucune policy anon : tables internes, accès backend service_role uniquement (bypass RLS).
-- (deny-by-default pour anon — intentionnel, pas de surface publique.)

-- ---------- 4. Prédicat canonique PIÈCE (point-read, autorité SQL pour panier/prix) ----------
-- is_piece_sellable = piece_display=true ∧ ∃ ligne prix vendable (pri_dispo IN ('1','2','3') ∧ ttc>0).
-- Lit les tables SOURCE en direct (jamais le rollup R2) → panier toujours frais, jamais périmé.
-- STABLE (read-only). Cross-testé contre le prédicat agrégat de la RPC ci-dessous (anti-divergence).
CREATE OR REPLACE FUNCTION public.is_piece_sellable(p_piece_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((SELECT p.piece_display FROM public.pieces p WHERE p.piece_id = p_piece_id), false)
     AND EXISTS (
       SELECT 1 FROM public.pieces_price pp
       WHERE pp.pri_piece_id_i = p_piece_id
         AND pp.pri_dispo IN ('1','2','3')
         AND pp.pri_vente_ttc_n > 0
     );
$$;

COMMENT ON FUNCTION public.is_piece_sellable(integer) IS
  'Prédicat canonique PIÈCE (STABLE, read-only) : piece_display ∧ ∃ ligne prix pri_dispo IN (1,2,3) ∧ ttc>0. Autorité SQL point-read pour panier/prix (lit les tables source, jamais le rollup R2). Cross-testé vs le prédicat agrégat de refresh_catalog_sellable_candidates.';

-- ---------- 5. RPC de refresh DELTA / STALE / SHARD (VOLATILE, écrit la projection) ----------
-- Modes (exclusifs, priorité delta > stale > shard) :
--   • DELTA  : p_piece_ids non-NULL → recompute les paires (type,pg) portant ces pièces (idx_prt_piece_id).
--   • STALE  : p_stale_only=true    → draine les lignes refreshed_at IS NULL, capé à p_limit.
--   • SHARD  : p_type_lo/p_type_hi   → recompute les paires d'une plage type_id (safety hebdo, index-friendly).
-- JAMAIS de full sweep (le recompute all-pairs = opération prohibitive 1,2 s/type × 28 505).
-- Retourne le nombre de paires (type,pg) upsertées.
CREATE OR REPLACE FUNCTION public.refresh_catalog_sellable_candidates(
  p_piece_ids integer[] DEFAULT NULL,
  p_stale_only boolean  DEFAULT false,
  p_type_lo   integer   DEFAULT NULL,
  p_type_hi   integer   DEFAULT NULL,
  p_limit     integer   DEFAULT 5000
) RETURNS integer
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  v_pairs integer := 0;
BEGIN
  WITH target_pairs AS (
    -- DELTA : paires des pièces touchées
    SELECT DISTINCT r.rtp_type_id AS type_id_i, r.rtp_pg_id AS pg_id
    FROM public.pieces_relation_type r
    WHERE p_piece_ids IS NOT NULL
      AND r.rtp_piece_id = ANY (p_piece_ids)
      AND r.rtp_type_id IS NOT NULL AND r.rtp_pg_id IS NOT NULL
    UNION
    -- STALE : lignes déjà marquées stale (refreshed_at IS NULL), capé
    SELECT s.type_id_i, s.pg_id
    FROM (
      SELECT c.type_id_i, c.pg_id
      FROM public.__catalog_sellable_candidates c
      WHERE p_stale_only AND c.refreshed_at IS NULL
      ORDER BY c.type_id_i, c.pg_id
      LIMIT GREATEST(p_limit, 0)
    ) s
    UNION
    -- SHARD : plage type_id (safety reconcile borné, index composite rtp_type_id)
    SELECT DISTINCT r.rtp_type_id, r.rtp_pg_id
    FROM public.pieces_relation_type r
    WHERE p_type_lo IS NOT NULL AND p_type_hi IS NOT NULL
      AND r.rtp_type_id >= p_type_lo AND r.rtp_type_id < p_type_hi
      AND r.rtp_type_id IS NOT NULL AND r.rtp_pg_id IS NOT NULL
  ),
  computed AS (
    SELECT
      tp.type_id_i,
      tp.pg_id,
      -- chaîne display (cheap) : type ∧ modele ∧ marque ∧ pg
      ( COALESCE(at.type_display, '') = '1'
        AND COALESCE(am.modele_display, 0) = 1
        AND COALESCE(amq.marque_display, 0) = 1
        AND COALESCE(pg.pg_display, '') = '1' )                         AS catalog_active,
      COALESCE(agg.sellable_pieces, 0)                                  AS price_sellable_count,
      agg.min_price,
      COALESCE(agg.has_price, false)                                   AS has_price,
      COALESCE(agg.has_dispo, false)                                   AS has_dispo
    FROM target_pairs tp
    LEFT JOIN public.auto_type   at  ON at.type_id_i = tp.type_id_i
    LEFT JOIN public.auto_modele am  ON am.modele_id = NULLIF(at.type_modele_id, '')::int
    LEFT JOIN public.auto_marque amq ON amq.marque_id = am.modele_marque_id
    LEFT JOIN public.pieces_gamme pg ON pg.pg_id = tp.pg_id
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (WHERE px.is_sellable)                          AS sellable_pieces,
        MIN(px.min_ttc) FILTER (WHERE px.is_sellable)                  AS min_price,
        bool_or(px.row_has_price)                                      AS has_price,
        bool_or(px.row_has_dispo)                                      AS has_dispo
      FROM public.pieces_relation_type r2
      JOIN public.pieces p ON p.piece_id = r2.rtp_piece_id
      LEFT JOIN LATERAL (
        SELECT
          bool_or(pp.pri_vente_ttc_n > 0)                                            AS row_has_price,
          bool_or(pp.pri_dispo IN ('1','2','3'))                                      AS row_has_dispo,
          bool_or(pp.pri_dispo IN ('1','2','3') AND pp.pri_vente_ttc_n > 0)
            AND p.piece_display                                                       AS is_sellable,
          MIN(pp.pri_vente_ttc_n) FILTER (WHERE pp.pri_dispo IN ('1','2','3') AND pp.pri_vente_ttc_n > 0) AS min_ttc
        FROM public.pieces_price pp
        WHERE pp.pri_piece_id_i = p.piece_id
      ) px ON true
      WHERE r2.rtp_type_id = tp.type_id_i AND r2.rtp_pg_id = tp.pg_id
    ) agg ON true
  ),
  upserted AS (
    INSERT INTO public.__catalog_sellable_candidates AS t
      (type_id_i, pg_id, catalog_active, price_sellable_count, min_price, has_price, has_dispo, refreshed_at)
    SELECT c.type_id_i, c.pg_id, c.catalog_active, c.price_sellable_count, c.min_price, c.has_price, c.has_dispo, now()
    FROM computed c
    ON CONFLICT (type_id_i, pg_id) DO UPDATE SET
      catalog_active       = EXCLUDED.catalog_active,
      price_sellable_count = EXCLUDED.price_sellable_count,
      min_price            = EXCLUDED.min_price,
      has_price            = EXCLUDED.has_price,
      has_dispo            = EXCLUDED.has_dispo,
      refreshed_at         = EXCLUDED.refreshed_at
    RETURNING 1
  )
  SELECT count(*) INTO v_pairs FROM upserted;

  RETURN v_pairs;
END;
$$;

COMMENT ON FUNCTION public.refresh_catalog_sellable_candidates(integer[], boolean, integer, integer, integer) IS
  'Refresh DELTA/STALE/SHARD (VOLATILE) du rollup __catalog_sellable_candidates. Modes exclusifs : DELTA (p_piece_ids → paires des pièces touchées), STALE (p_stale_only → draine refreshed_at IS NULL capé p_limit), SHARD (p_type_lo/p_type_hi → plage type_id, safety hebdo). Prédicat canonique inline = autorité SQL d''agrégat (aligné SellabilityTruthService TS). JAMAIS de full sweep. Schéma public pinné.';

-- ---------- 6. RPC diagnostic read-only (cheap : stats du rollup + readiness) ----------
CREATE OR REPLACE FUNCTION public.catalog_sellable_diagnostic()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'ready',                     (SELECT ready FROM public.__catalog_sellable_meta WHERE singleton),
    'backfill_completed_at',     (SELECT backfill_completed_at FROM public.__catalog_sellable_meta WHERE singleton),
    'pairs_total',               (SELECT count(*) FROM public.__catalog_sellable_candidates),
    'pairs_stale',               (SELECT count(*) FROM public.__catalog_sellable_candidates WHERE refreshed_at IS NULL),
    'pairs_sellable',            (SELECT count(*) FROM public.__catalog_sellable_candidates WHERE sellable_count > 0),
    -- pièces prix-vendables mais page éteinte par la chaîne display (catalog_active=false) = strandées
    'pairs_stranded_by_display', (SELECT count(*) FROM public.__catalog_sellable_candidates WHERE price_sellable_count > 0 AND NOT catalog_active),
    'sum_sellable_count',        (SELECT COALESCE(sum(sellable_count), 0) FROM public.__catalog_sellable_candidates),
    'refreshed_at_min',          (SELECT min(refreshed_at) FROM public.__catalog_sellable_candidates),
    'refreshed_at_max',          (SELECT max(refreshed_at) FROM public.__catalog_sellable_candidates)
  );
$$;

COMMENT ON FUNCTION public.catalog_sellable_diagnostic() IS
  'Diagnostic read-only (STABLE) du rollup __catalog_sellable_candidates : ready, pairs_total/stale/sellable, pairs_stranded_by_display (price_sellable_count>0 ∧ NOT catalog_active), sum_sellable_count, fenêtre refreshed_at. Cheap (agrège le rollup, pas le catalogue). NE statue PAS sur l''indexabilité (politique SEO).';

-- =====================================================
-- ROLLBACK (structurel) — owner-gated, ordre inverse :
--   DROP FUNCTION IF EXISTS public.catalog_sellable_diagnostic();
--   DROP FUNCTION IF EXISTS public.refresh_catalog_sellable_candidates(integer[], boolean, integer, integer, integer);
--   DROP FUNCTION IF EXISTS public.is_piece_sellable(integer);
--   DROP TABLE IF EXISTS public.__catalog_sellable_candidates;
--   DROP TABLE IF EXISTS public.__catalog_sellable_meta;
-- (projection régénérable — aucune perte de donnée catalogue.)
-- =====================================================
