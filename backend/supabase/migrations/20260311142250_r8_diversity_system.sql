-- squawk-ignore-file prefer-bigint-over-int
-- squawk-ignore-file prefer-identity
--
-- Rationale (reconstruction fidèle, pas une nouvelle table) :
--   Ce fichier REPRODUIT à l'identique des tables qui existent DÉJÀ sur la DB
--   live. Les types doivent matcher la structure live au byte près (vérifié :
--   MD5 par-table colonnes scratch == live). « Moderniser » ces colonnes
--   créerait une DÉRIVE de schéma entre fresh-deploy et live :
--     - `prefer-bigint-over-int` : page_count / version_no / priority / attempts
--       sont INTEGER sur live. Les passer en BIGINT divergerait du réel.
--     - `prefer-identity` : __seo_r8_keyword_plan.id est un BIGSERIAL (séquence
--       possédée `__seo_r8_keyword_plan_id_seq`, default nextval) sur live ;
--       le passer en IDENTITY changerait le mécanisme et le default → dérive.
--   (__seo_r8_snapshot_store.id EST déjà GENERATED ALWAYS AS IDENTITY sur live —
--    reproduit tel quel ; seul keyword_plan reste volontairement BIGSERIAL.)
--
-- =============================================================================
-- Migration : R8 Diversity System — base DDL (reconstruction idempotente)
-- Date      : 2026-03-11 (timestamp ledger d'origine conservé : 20260311142250)
-- Severity  : LOW (no-op sur la DB live — 100 % IF NOT EXISTS / guard DO-block)
-- Spec      : plan balises R0→R8, P-PRECOND.2 (commit du DDL base-table)
-- =============================================================================
--
-- POURQUOI CE FICHIER
-- -------------------
-- Le fichier migration d'origine `20260311142250_r8_diversity_system.sql` est
-- ABSENT de `backend/supabase/migrations/`, alors que :
--   * la DB live porte les 9 tables `__seo_r8_*` de ce sous-système, et
--   * `supabase_migrations.schema_migrations` contient bien la version
--     `20260311142250`.
-- La chaîne de migration est donc INCOHÉRENTE : un déploiement reconstruit
-- depuis zéro ne peut pas recréer ce sous-système (et les contraintes FK qui
-- le relient). Ce fichier RECONSTRUIT fidèlement ce DDL depuis la structure
-- live (extraction read-only via les sérialiseurs canon de Postgres :
-- format_type / pg_get_constraintdef / pg_indexes.indexdef / pg_get_triggerdef),
-- de manière strictement idempotente, pour :
--   1. rendre la chaîne de migration cohérente (record fidèle), et
--   2. donner aux migrations additives ultérieures (ex. colonnes balise R8,
--      plan P-PRECOND.2 → D-2) une base committée dont dépendre.
--
-- PÉRIMÈTRE — 9 tables (ordre de création = dépendances FK)
-- ---------------------------------------------------------
--   1. __seo_r8_snapshot_store      (racine)
--   2. __seo_r8_engine_family_stats (racine, PK naturelle)
--   3. __seo_r8_keyword_plan        (racine)
--   4. __seo_r8_pages               (FK current_snapshot_id → snapshot_store)
--   5. __seo_r8_fingerprints        (FK page_id → pages)
--   6. __seo_r8_page_versions       (FK page_id → pages)
--   7. __seo_r8_qa_reviews          (FK page_id → pages)
--   8. __seo_r8_regeneration_queue  (FK page_id → pages, nullable)
--   9. __seo_r8_similarity_index    (FK page_id + compared_page_id → pages)
--
-- RLS (zero-trust, pattern ADR-021)
-- ---------------------------------
--   * RLS activée sur les 9 tables
--   * 1 policy `<table>_service_role_all` (ALL TO service_role USING/CHECK true)
--   * anon / authenticated : REVOKE ALL (aucun accès client)
--   * service_role : BYPASSRLS via attribut de rôle, pas de re-grant explicite
--
-- IDEMPOTENCE / NO-OP SUR LIVE
-- ----------------------------
--   * CREATE TABLE IF NOT EXISTS  (contraintes PK/UNIQUE/CHECK/FK inline →
--     non réévaluées quand la table existe déjà)
--   * CREATE INDEX IF NOT EXISTS
--   * CREATE POLICY dans un DO-block guardé (pg_policies)
--   * CREATE TRIGGER dans un DO-block guardé (pg_trigger)
--   * AUCUN `COMMENT ON` : les tables live n'ont aucun commentaire — en ajouter
--     muterait l'état live. Documentation portée par ces commentaires `--`.
--   Ré-appliquer ce fichier sur la DB déjà migrée = no-op total.
--
-- DÉPENDANCES FONCTIONS (triggers)
-- --------------------------------
--   Les triggers référencent 2 fonctions définies par LEURS propres migrations :
--     * enforce_agent_write_scope()  — fonction de gouvernance TRANSVERSE
--       (≠ R8), owned par `20260616_vague5_revoke_safe_trigger_cron_execute.sql`.
--     * __seo_r8_set_updated_at()    — owned par
--       `20260616_vague5_pin_function_search_path.sql`.
--   Ces fonctions ne sont donc PAS (re)créées ici (ownership respecté). Chaque
--   CREATE TRIGGER est guardé sur l'existence de sa fonction : si absente, un
--   `RAISE NOTICE` explicite est émis (observable, jamais un skip silencieux) et
--   le trigger est créé plus tard quand la fonction existe. Sur live, fonctions
--   ET triggers existent déjà → no-op. NB : l'ordre de création de ces fonctions
--   dans la chaîne (définies en 20260616, antérieurement utilisées) est une
--   incohérence PRÉEXISTANTE de chaîne, hors périmètre de ce fichier.
--
-- ROLLBACK (documentation seule — NON exécuté)
-- --------------------------------------------
--   Voir bloc en fin de fichier. Tables existantes + peuplées sur live →
--   un rollback réel est une décision ops séparée, jamais portée par ce fichier.
-- =============================================================================

-- Transaction gérée par le runner de migration (.squawk.toml :
-- assume_in_transaction = true) → pas de BEGIN/COMMIT explicite ici.
SET LOCAL lock_timeout      = '5s';
SET LOCAL statement_timeout = '120s';

-- -----------------------------------------------------------------------------
-- 1. __seo_r8_snapshot_store — store immuable des snapshots de disambiguïsation
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.__seo_r8_snapshot_store (
    id                       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    type_id                  BIGINT NOT NULL,
    version_sha              TEXT NOT NULL UNIQUE,
    disambiguation_signature JSONB NOT NULL,
    enrichment_status        TEXT NOT NULL
        CHECK (enrichment_status IN ('minimal', 'enriched', 'stale', 'failed')),
    source_lineage           JSONB,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_r8_snapshot_status_stale
    ON public.__seo_r8_snapshot_store (enrichment_status)
    WHERE enrichment_status = 'stale';

CREATE INDEX IF NOT EXISTS idx_r8_snapshot_type_created
    ON public.__seo_r8_snapshot_store (type_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_r8_snapshot_version_sha
    ON public.__seo_r8_snapshot_store (version_sha);

ALTER TABLE public.__seo_r8_snapshot_store ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
        AND tablename = '__seo_r8_snapshot_store'
        AND policyname = '__seo_r8_snapshot_store_service_role_all') THEN
        CREATE POLICY __seo_r8_snapshot_store_service_role_all
            ON public.__seo_r8_snapshot_store AS PERMISSIVE FOR ALL
            TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;
REVOKE ALL ON public.__seo_r8_snapshot_store FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. __seo_r8_engine_family_stats — stats agrégées par famille moteur (PK nat.)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.__seo_r8_engine_family_stats (
    engine_family_key             TEXT PRIMARY KEY,
    page_count                    INTEGER NOT NULL DEFAULT 0,
    avg_diversity_score           NUMERIC(5,2) NOT NULL DEFAULT 0,
    avg_semantic_similarity_score NUMERIC(5,2) NOT NULL DEFAULT 0,
    avg_faq_reuse_risk_score      NUMERIC(5,2) NOT NULL DEFAULT 0,
    avg_catalog_delta_score       NUMERIC(5,2) NOT NULL DEFAULT 0,
    updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.__seo_r8_engine_family_stats ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
        AND tablename = '__seo_r8_engine_family_stats'
        AND policyname = '__seo_r8_engine_family_stats_service_role_all') THEN
        CREATE POLICY __seo_r8_engine_family_stats_service_role_all
            ON public.__seo_r8_engine_family_stats AS PERMISSIVE FOR ALL
            TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;
REVOKE ALL ON public.__seo_r8_engine_family_stats FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. __seo_r8_keyword_plan — plan mots-clés / pipeline P0..Pn par type_id
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.__seo_r8_keyword_plan (
    id                    BIGSERIAL PRIMARY KEY,
    type_id               TEXT NOT NULL UNIQUE,
    brand                 TEXT NOT NULL,
    model                 TEXT NOT NULL,
    type_name             TEXT NOT NULL,
    power                 TEXT,
    fuel                  TEXT,
    years                 TEXT,
    intent_map            JSONB NOT NULL DEFAULT '{}'::jsonb,
    sections              JSONB NOT NULL DEFAULT '[]'::jsonb,
    quality               JSONB NOT NULL DEFAULT '{}'::jsonb,
    evidence              JSONB NOT NULL DEFAULT '{}'::jsonb,
    status                TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'validated', 'rejected')),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    intent_boundary       JSONB DEFAULT '{}'::jsonb,
    query_pool            JSONB DEFAULT '[]'::jsonb,
    clusters              JSONB DEFAULT '[]'::jsonb,
    rejected_queries      JSONB DEFAULT '[]'::jsonb,
    heading_plan          JSONB DEFAULT '{}'::jsonb,
    pipeline_phase        TEXT DEFAULT 'P0_BOUNDARY'::text,
    content_focus_targets JSONB DEFAULT '[]'::jsonb,
    coverage_map          JSONB DEFAULT '[]'::jsonb,
    negatives_final       JSONB DEFAULT '[]'::jsonb,
    media_slots           JSONB DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_r8_kp_status
    ON public.__seo_r8_keyword_plan (status);

CREATE INDEX IF NOT EXISTS idx_r8_kp_type
    ON public.__seo_r8_keyword_plan (type_id);

ALTER TABLE public.__seo_r8_keyword_plan ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
        AND tablename = '__seo_r8_keyword_plan'
        AND policyname = '__seo_r8_keyword_plan_service_role_all') THEN
        CREATE POLICY __seo_r8_keyword_plan_service_role_all
            ON public.__seo_r8_keyword_plan AS PERMISSIVE FOR ALL
            TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;
REVOKE ALL ON public.__seo_r8_keyword_plan FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. __seo_r8_pages — fiche véhicule R8 (table pivot du sous-système)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.__seo_r8_pages (
    id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_key                       TEXT NOT NULL UNIQUE,
    page_role                      TEXT NOT NULL CHECK (page_role = 'R8'),
    brand                          TEXT NOT NULL,
    model                          TEXT NOT NULL,
    type_name                      TEXT NOT NULL,
    power_ps                       TEXT NOT NULL,
    fuel                           TEXT NOT NULL,
    body                           TEXT NOT NULL,
    year_from                      TEXT NOT NULL,
    year_to                        TEXT,
    engine_codes                   JSONB NOT NULL DEFAULT '[]'::jsonb,
    cnit_codes                     JSONB NOT NULL DEFAULT '[]'::jsonb,
    mine_codes                     JSONB NOT NULL DEFAULT '[]'::jsonb,
    brand_id                       TEXT,
    model_id                       TEXT,
    type_id                        TEXT,
    canonical_url                  TEXT NOT NULL,
    h1                             TEXT NOT NULL,
    meta_title                     TEXT NOT NULL,
    meta_description               TEXT NOT NULL,
    content_main                   TEXT NOT NULL,
    rendered_json                  JSONB NOT NULL,
    block_plan                     JSONB NOT NULL,
    seo_decision                   TEXT NOT NULL
        CHECK (seo_decision IN ('INDEX', 'REVIEW_REQUIRED', 'REGENERATE', 'REJECT')),
    specific_content_ratio         NUMERIC(5,4) NOT NULL DEFAULT 0,
    boilerplate_ratio              NUMERIC(5,4) NOT NULL DEFAULT 0,
    diversity_score                NUMERIC(5,2) NOT NULL DEFAULT 0,
    semantic_similarity_score      NUMERIC(5,2) NOT NULL DEFAULT 0,
    category_order_diversity_score NUMERIC(5,2) NOT NULL DEFAULT 0,
    faq_reuse_risk_score           NUMERIC(5,2) NOT NULL DEFAULT 0,
    catalog_delta_score            NUMERIC(5,2) NOT NULL DEFAULT 0,
    commercial_intent_score        NUMERIC(5,2) NOT NULL DEFAULT 0,
    content_fingerprint            TEXT NOT NULL,
    normalized_text_fingerprint    TEXT NOT NULL,
    faq_signature                  TEXT NOT NULL,
    category_signature             TEXT NOT NULL,
    neighbor_family_key            TEXT NOT NULL,
    engine_family_key              TEXT NOT NULL,
    sitemap_included               BOOLEAN NOT NULL DEFAULT false,
    robots_directive               TEXT NOT NULL DEFAULT 'noindex, nofollow'::text,
    review_required_since          TIMESTAMPTZ,
    published_at                   TIMESTAMPTZ,
    created_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_snapshot_id            BIGINT
        REFERENCES public.__seo_r8_snapshot_store (id)
);

CREATE INDEX IF NOT EXISTS idx_r8_pages_current_snapshot
    ON public.__seo_r8_pages (current_snapshot_id)
    WHERE current_snapshot_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_seo_r8_pages_decision
    ON public.__seo_r8_pages (seo_decision, sitemap_included);

CREATE INDEX IF NOT EXISTS idx_seo_r8_pages_engine_family
    ON public.__seo_r8_pages (engine_family_key);

CREATE INDEX IF NOT EXISTS idx_seo_r8_pages_family
    ON public.__seo_r8_pages (brand, model, fuel, body);

CREATE INDEX IF NOT EXISTS idx_seo_r8_pages_neighbor_family
    ON public.__seo_r8_pages (neighbor_family_key);

ALTER TABLE public.__seo_r8_pages ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
        AND tablename = '__seo_r8_pages'
        AND policyname = '__seo_r8_pages_service_role_all') THEN
        CREATE POLICY __seo_r8_pages_service_role_all
            ON public.__seo_r8_pages AS PERMISSIVE FOR ALL
            TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;
REVOKE ALL ON public.__seo_r8_pages FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. __seo_r8_fingerprints — empreintes contenu (anti-duplicate R8)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.__seo_r8_fingerprints (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id                     UUID NOT NULL
        REFERENCES public.__seo_r8_pages (id) ON DELETE CASCADE,
    page_key                    TEXT NOT NULL,
    neighbor_family_key         TEXT NOT NULL,
    engine_family_key           TEXT NOT NULL,
    content_fingerprint         TEXT NOT NULL,
    normalized_text_fingerprint TEXT NOT NULL,
    block_sequence_fingerprint  TEXT NOT NULL,
    semantic_key_fingerprint    TEXT NOT NULL,
    faq_signature               TEXT NOT NULL,
    category_signature          TEXT NOT NULL,
    top_tokens                  JSONB NOT NULL DEFAULT '[]'::jsonb,
    block_type_sequence         JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.__seo_r8_fingerprints ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
        AND tablename = '__seo_r8_fingerprints'
        AND policyname = '__seo_r8_fingerprints_service_role_all') THEN
        CREATE POLICY __seo_r8_fingerprints_service_role_all
            ON public.__seo_r8_fingerprints AS PERMISSIVE FOR ALL
            TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;
REVOKE ALL ON public.__seo_r8_fingerprints FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6. __seo_r8_page_versions — historique versionné des pages
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.__seo_r8_page_versions (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id                   UUID NOT NULL
        REFERENCES public.__seo_r8_pages (id) ON DELETE CASCADE,
    version_no                INTEGER NOT NULL,
    content_main              TEXT NOT NULL,
    rendered_json             JSONB NOT NULL,
    block_plan                JSONB NOT NULL,
    seo_decision              TEXT NOT NULL,
    diversity_score           NUMERIC(5,2) NOT NULL,
    semantic_similarity_score NUMERIC(5,2) NOT NULL,
    catalog_delta_score       NUMERIC(5,2) NOT NULL,
    commercial_intent_score   NUMERIC(5,2) NOT NULL,
    content_fingerprint       TEXT NOT NULL,
    faq_signature             TEXT NOT NULL,
    category_signature        TEXT NOT NULL,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (page_id, version_no)
);

ALTER TABLE public.__seo_r8_page_versions ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
        AND tablename = '__seo_r8_page_versions'
        AND policyname = '__seo_r8_page_versions_service_role_all') THEN
        CREATE POLICY __seo_r8_page_versions_service_role_all
            ON public.__seo_r8_page_versions AS PERMISSIVE FOR ALL
            TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;
REVOKE ALL ON public.__seo_r8_page_versions FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- 7. __seo_r8_qa_reviews — revues QA des pages
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.__seo_r8_qa_reviews (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id       UUID NOT NULL
        REFERENCES public.__seo_r8_pages (id) ON DELETE CASCADE,
    reviewer      TEXT,
    review_status TEXT NOT NULL DEFAULT 'TODO'
        CHECK (review_status IN ('TODO', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED')),
    notes         TEXT,
    actions       JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.__seo_r8_qa_reviews ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
        AND tablename = '__seo_r8_qa_reviews'
        AND policyname = '__seo_r8_qa_reviews_service_role_all') THEN
        CREATE POLICY __seo_r8_qa_reviews_service_role_all
            ON public.__seo_r8_qa_reviews AS PERMISSIVE FOR ALL
            TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;
REVOKE ALL ON public.__seo_r8_qa_reviews FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- 8. __seo_r8_regeneration_queue — file de régénération (page_id nullable)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.__seo_r8_regeneration_queue (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id        UUID
        REFERENCES public.__seo_r8_pages (id) ON DELETE CASCADE,
    page_key       TEXT NOT NULL,
    reason_code    TEXT NOT NULL,
    reason_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    status         TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'RUNNING', 'DONE', 'FAILED', 'CANCELLED')),
    priority       INTEGER NOT NULL DEFAULT 100,
    attempts       INTEGER NOT NULL DEFAULT 0,
    scheduled_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seo_r8_queue_status
    ON public.__seo_r8_regeneration_queue (status, priority, scheduled_at);

ALTER TABLE public.__seo_r8_regeneration_queue ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
        AND tablename = '__seo_r8_regeneration_queue'
        AND policyname = '__seo_r8_regeneration_queue_service_role_all') THEN
        CREATE POLICY __seo_r8_regeneration_queue_service_role_all
            ON public.__seo_r8_regeneration_queue AS PERMISSIVE FOR ALL
            TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;
REVOKE ALL ON public.__seo_r8_regeneration_queue FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- 9. __seo_r8_similarity_index — index de similarité page↔page
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.__seo_r8_similarity_index (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id                         UUID NOT NULL
        REFERENCES public.__seo_r8_pages (id) ON DELETE CASCADE,
    compared_page_id                UUID NOT NULL
        REFERENCES public.__seo_r8_pages (id) ON DELETE CASCADE,
    semantic_similarity_score       NUMERIC(5,2) NOT NULL,
    faq_similarity_score            NUMERIC(5,2) NOT NULL,
    category_order_similarity_score NUMERIC(5,2) NOT NULL,
    overall_similarity_score        NUMERIC(5,2) NOT NULL,
    comparison_scope                TEXT NOT NULL
        CHECK (comparison_scope IN ('NEAREST_NEIGHBOR', 'ENGINE_FAMILY', 'MODEL_FAMILY')),
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (page_id, compared_page_id, comparison_scope)
);

CREATE INDEX IF NOT EXISTS idx_seo_r8_similarity_page
    ON public.__seo_r8_similarity_index (page_id, overall_similarity_score DESC);

ALTER TABLE public.__seo_r8_similarity_index ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
        AND tablename = '__seo_r8_similarity_index'
        AND policyname = '__seo_r8_similarity_index_service_role_all') THEN
        CREATE POLICY __seo_r8_similarity_index_service_role_all
            ON public.__seo_r8_similarity_index AS PERMISSIVE FOR ALL
            TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;
REVOKE ALL ON public.__seo_r8_similarity_index FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- 10. Triggers (guardés sur existence de fonction — voir DÉPENDANCES FONCTIONS)
-- -----------------------------------------------------------------------------

-- 10a. Write-scope governance trigger (enforce_agent_write_scope) sur les 9 tables.
DO $$
DECLARE
    tbl  TEXT;
    trg  TEXT;
    tbls TEXT[] := ARRAY[
        '__seo_r8_snapshot_store', '__seo_r8_engine_family_stats',
        '__seo_r8_keyword_plan', '__seo_r8_pages', '__seo_r8_fingerprints',
        '__seo_r8_page_versions', '__seo_r8_qa_reviews',
        '__seo_r8_regeneration_queue', '__seo_r8_similarity_index'
    ];
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE p.proname = 'enforce_agent_write_scope' AND n.nspname = 'public'
    ) THEN
        RAISE NOTICE 'R8 write-scope triggers skipped: public.enforce_agent_write_scope() absent (owned by 20260616_vague5_revoke_safe_trigger_cron_execute.sql); triggers will be created when that function exists.';
    ELSE
        FOREACH tbl IN ARRAY tbls LOOP
            trg := 'trg_write_scope_' || tbl;  -- live: trg_write_scope___seo_r8_<x>
            IF NOT EXISTS (
                SELECT 1 FROM pg_trigger
                WHERE tgrelid = ('public.' || tbl)::regclass AND tgname = trg
            ) THEN
                EXECUTE format(
                    'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I '
                    || 'FOR EACH ROW EXECUTE FUNCTION enforce_agent_write_scope()',
                    trg, tbl
                );
            END IF;
        END LOOP;
    END IF;
END $$;

-- 10b. updated_at maintenance trigger (__seo_r8_set_updated_at) sur pages + qa_reviews.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE p.proname = '__seo_r8_set_updated_at' AND n.nspname = 'public'
    ) THEN
        RAISE NOTICE 'R8 updated_at triggers skipped: public.__seo_r8_set_updated_at() absent (owned by 20260616_vague5_pin_function_search_path.sql); triggers will be created when that function exists.';
    ELSE
        IF NOT EXISTS (SELECT 1 FROM pg_trigger
            WHERE tgrelid = 'public.__seo_r8_pages'::regclass
              AND tgname = 'trg_seo_r8_pages_updated_at') THEN
            CREATE TRIGGER trg_seo_r8_pages_updated_at
                BEFORE UPDATE ON public.__seo_r8_pages
                FOR EACH ROW EXECUTE FUNCTION __seo_r8_set_updated_at();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger
            WHERE tgrelid = 'public.__seo_r8_qa_reviews'::regclass
              AND tgname = 'trg_seo_r8_qa_reviews_updated_at') THEN
            CREATE TRIGGER trg_seo_r8_qa_reviews_updated_at
                BEFORE UPDATE ON public.__seo_r8_qa_reviews
                FOR EACH ROW EXECUTE FUNCTION __seo_r8_set_updated_at();
        END IF;
    END IF;
END $$;

-- =============================================================================
-- End of migration.
-- Rollback (documentation seule — NON exécuté par ce fichier) :
--   Les 9 tables existent et sont peuplées sur live ; tout DROP est une décision
--   ops séparée, owner-gated, jamais portée par ce fichier de reconstruction.
--   Ordre DROP (inverse des FK), pour mémoire :
--     DROP TABLE IF EXISTS public.__seo_r8_similarity_index   CASCADE;
--     DROP TABLE IF EXISTS public.__seo_r8_regeneration_queue CASCADE;
--     DROP TABLE IF EXISTS public.__seo_r8_qa_reviews         CASCADE;
--     DROP TABLE IF EXISTS public.__seo_r8_page_versions      CASCADE;
--     DROP TABLE IF EXISTS public.__seo_r8_fingerprints       CASCADE;
--     DROP TABLE IF EXISTS public.__seo_r8_pages              CASCADE;
--     DROP TABLE IF EXISTS public.__seo_r8_keyword_plan       CASCADE;
--     DROP TABLE IF EXISTS public.__seo_r8_engine_family_stats CASCADE;
--     DROP TABLE IF EXISTS public.__seo_r8_snapshot_store      CASCADE;
-- =============================================================================
