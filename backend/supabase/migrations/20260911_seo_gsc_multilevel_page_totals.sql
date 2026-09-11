-- =====================================================
-- SEO GSC — Grain page FIDÈLE + marqueur de commit journalier
-- Date: 2026-09-11
-- Refs: audit/seo-sept-leviers-2026-09-11.md (P1, défauts D2/D4)
--       20260613_seo_gsc_multilevel_grains.sql (famille de tables, fonction partitions)
--       20260616_vague5_harden_partition_maintenance.sql (__rls_lock_internal_table)
--       packages/seo-types/src/observability.ts (GSCDailyPageTotalsRowSchema, GSC_INGEST_COMMIT_VERSION)
-- =====================================================
--
-- POURQUOI (mesures API live 2026-09-10, jours 07-15 / 08-20 / 09-01, clics/impressions) :
--   dimension `page` seule          : 86/5 776 · 84/6 160 · 79/5 730  (≈ property_total 85/5 653 · 84/5 893 · 79/5 506)
--   `page+country+device` (actuel)  :  6/1 377 ·  5/2 203 ·  8/2 282  (≡ grain requêtes)
-- `__seo_gsc_daily_pages` perd ~93 % des clics par construction : `rpc_seo_low_ctr_v3`
-- qui le somme sous-estime le CTR par page ~10× (faux « low CTR »). Ce grain reste
-- le détail segmenté ; le grain fidèle part dans une table additive (1 table/grain).
--
-- Marqueur `commit_version` (D4 + imports partiels) : le fetcher upserte
-- `__seo_gsc_daily_property_total` EN DERNIER avec `commit_version` quand tous les
-- grains du jour sont persistés avec une donnée finale. NULL = ligne antérieure
-- (pas une preuve) → ré-ingérée par la fenêtre de rattrapage. Un upsert PostgREST
-- qui omet la colonne ne la remet pas à NULL (merge-duplicates = colonnes fournies).
--
-- DÉPENDANCE (constat technique, pas une autorisation d'appliquer) : le fetcher de
-- la même branche lit `commit_version`. Tout environnement qui exécute ce code sans
-- la migration voit sa 1re lecture échouer `schema_drift` → run journalisé en échec,
-- AUCUNE écriture de données (fail loud, pas partiel). L'application suit la
-- procédure de livraison (revue, tests, GO ciblé, apply-supabase-migrations.yml) :
-- audit/seo-sept-leviers-2026-09-11.md.
--
-- Additive · idempotente (IF NOT EXISTS / CREATE OR REPLACE même signature) ·
-- réversible (.down.sql, donnée re-fetchable depuis GSC). Pas de BEGIN/COMMIT
-- (squawk assume_in_transaction=true ; le runner encadre la transaction).
-- Taille : property_total = 70 lignes (2026-09-10) → ADD COLUMN nullable instantané.
-- =====================================================

-- Ops métadonnées sur tables neuves/vides + ADD COLUMN nullable → timeouts bornés.
set lock_timeout = '5s';
set statement_timeout = '60s';

-- =====================================================
-- TABLE : __seo_gsc_daily_page_totals  (grain = date+page, agrégation byPage)
-- =====================================================
CREATE TABLE IF NOT EXISTS __seo_gsc_daily_page_totals (
    date DATE NOT NULL,
    page TEXT NOT NULL,
    clicks BIGINT NOT NULL DEFAULT 0 CHECK (clicks >= 0),
    impressions BIGINT NOT NULL DEFAULT 0 CHECK (impressions >= 0),
    ctr REAL NOT NULL DEFAULT 0 CHECK (ctr >= 0 AND ctr <= 1),
    position REAL NOT NULL DEFAULT 0 CHECK (position >= 0),
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (date, page)
) PARTITION BY RANGE (date);

CREATE INDEX IF NOT EXISTS idx_gsc_page_totals_page_date
    ON __seo_gsc_daily_page_totals (page, date DESC);

COMMENT ON TABLE __seo_gsc_daily_page_totals IS
  'GSC Search Analytics — performance par URL, grain FIDÈLE (dimension page seule, agrégation byPage ≈ property_total). Source des opportunités par page (rpc_seo_low_ctr_v4). Partitionné mensuel.';

COMMENT ON TABLE __seo_gsc_daily_pages IS
  'GSC Search Analytics — détail segmenté date+page+country+device (sans query). LOSSY : restitue ~7 % des clics de la propriété (mesure 2026-09-10). Ne pas sommer comme total par page — utiliser __seo_gsc_daily_page_totals. Partitionné mensuel.';

-- =====================================================
-- MARQUEUR DE COMMIT : __seo_gsc_daily_property_total.commit_version
-- =====================================================
ALTER TABLE __seo_gsc_daily_property_total
    ADD COLUMN IF NOT EXISTS commit_version BIGINT;

COMMENT ON COLUMN __seo_gsc_daily_property_total.commit_version IS
  'NULL = ligne antérieure au contrat, ou jour en cours de réécriture (pas une preuve de commit). N >= 1 = tous les grains du contrat N lus puis persistés avec une donnée finale ; retiré avant réécriture et écrit EN DERNIER par gsc-daily-fetcher (GSC_INGEST_COMMIT_VERSION).';

-- =====================================================
-- PARTITIONS : historique depuis 2026-06 (1er mois multi-grain, rattrapage
-- possible) jusqu'au mois courant + 3 ; les suivantes via la fonction mensuelle.
-- =====================================================
DO $$
DECLARE
    v_month DATE;
BEGIN
    FOR v_month IN
        SELECT generate_series(
            DATE '2026-06-01',
            (date_trunc('month', CURRENT_DATE) + INTERVAL '3 month')::DATE,
            INTERVAL '1 month'
        )::DATE
    LOOP
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
            '__seo_gsc_daily_page_totals_' || to_char(v_month, 'YYYY_MM'),
            '__seo_gsc_daily_page_totals',
            v_month,
            (v_month + INTERVAL '1 month')::DATE
        );
    END LOOP;
END $$;

-- =====================================================
-- FONCTION : __seo_ensure_monthly_partitions — MÊME signature (INT) : pas de
-- surcharge (l'appel pg_cron `__seo_ensure_monthly_partitions(3)` reste non
-- ambigu). Corps identique à la définition en base au 2026-09-10 (+1 table),
-- search_path épinglé comme la vague 5.
-- =====================================================
CREATE OR REPLACE FUNCTION __seo_ensure_monthly_partitions(p_months_ahead INT DEFAULT 3)
RETURNS INT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_tables TEXT[] := ARRAY[
        '__seo_gsc_daily',
        '__seo_ga4_daily',
        '__seo_cwv_daily',
        '__seo_gsc_daily_property_total',
        '__seo_gsc_daily_totals',
        '__seo_gsc_daily_pages',
        '__seo_gsc_daily_page_totals'
    ];
    v_tbl TEXT;
    v_i INT;
    v_start DATE;
    v_end DATE;
    v_pname TEXT;
    v_created INT := 0;
BEGIN
    FOREACH v_tbl IN ARRAY v_tables LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_partitioned_table pt
            JOIN pg_class c ON c.oid = pt.partrelid
            WHERE c.relname = v_tbl
        ) THEN
            CONTINUE;
        END IF;
        FOR v_i IN 0..p_months_ahead LOOP
            v_start := date_trunc('month', CURRENT_DATE)::DATE + (v_i || ' month')::INTERVAL;
            v_end := (v_start + INTERVAL '1 month')::DATE;
            v_pname := v_tbl || '_' || to_char(v_start, 'YYYY_MM');
            IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = v_pname) THEN
                EXECUTE format(
                    'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
                    v_pname, v_tbl, v_start, v_end
                );
                v_created := v_created + 1;
            END IF;
        END LOOP;
    END LOOP;
    RETURN v_created;
END;
$$;

COMMENT ON FUNCTION __seo_ensure_monthly_partitions(INT) IS
  'Pré-crée idempotemment les partitions mensuelles (current..+N) des tables __seo time-series (dont __seo_gsc_daily_page_totals depuis 2026-09-11). Anti-incident 2026-05-06. Planifiée pg_cron mensuel.';

-- =====================================================
-- RLS : fenêtre d'exposition nulle — verrouillage immédiat (parent + partitions)
-- avec le helper vague 5 (REVOKE anon/authenticated + ENABLE RLS + policy
-- service_role), au lieu d'attendre le reconcile horaire.
-- =====================================================
DO $$
DECLARE
    r RECORD;
BEGIN
    IF to_regprocedure('public.__rls_lock_internal_table(text)') IS NULL THEN
        RAISE EXCEPTION 'prérequis absent : public.__rls_lock_internal_table(text) (20260616_vague5_harden_partition_maintenance)';
    END IF;
    FOR r IN
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'p')
          AND c.relname LIKE '\_\_seo\_gsc\_daily\_page\_totals%'
    LOOP
        PERFORM public.__rls_lock_internal_table(r.relname);
    END LOOP;
END $$;

-- =====================================================
-- Vérification post-apply (lecture seule)
-- =====================================================
--   SELECT c.relname, c.relrowsecurity FROM pg_class c
--     WHERE c.relname LIKE '__seo_gsc_daily_page_totals%' ORDER BY 1;
--   -- attendu : parent + 2026_06 .. mois courant+3, relrowsecurity = t
--   SELECT column_name, data_type FROM information_schema.columns
--     WHERE table_name = '__seo_gsc_daily_property_total' AND column_name = 'commit_version';
--   SELECT count(*) FILTER (WHERE commit_version IS NULL) AS legacy_rows FROM __seo_gsc_daily_property_total;
--   -- attendu : = nombre de lignes (aucune ligne commitée avant le nouveau fetcher)
--   SELECT proconfig FROM pg_proc WHERE proname = '__seo_ensure_monthly_partitions';
--   -- attendu : {search_path=public}
-- =====================================================
