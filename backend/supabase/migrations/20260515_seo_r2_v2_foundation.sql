-- =============================================================================
-- ADR-066 — R2 Content Composition v2 — Foundation tables
-- =============================================================================
--
-- Crée les 9 tables physiques splittées du pipeline R2 v2 (per-motorisation,
-- anti-duplicate, eligibility-gated). Pattern miroir des tables R8 existantes
-- (__seo_r8_pages, __seo_r8_fingerprints, etc.) mais avec :
--   - Split physique par cycle d'accès (hot/cold/froid) — anti mega JSONB,
--     VACUUM/TOAST/WAL isolés (cf MEMORY feedback_table_split_vs_mega_jsonb)
--   - SoT replay-safe = __seo_r2_composition_inputs (snapshot input, pas le
--     contenu généré, cf MEMORY feedback_seo_sot_is_composition_input_not_content)
--   - Décision SUPPRESSED canonical (sibling, pas reject), cf
--     feedback_seo_suppressed_canonical_decision
--   - Anti-canonical-chain (canonical_target_type_id FK soft, validation via
--     OPA Rego + cascade BullMQ revalidate, cf feedback_canonical_chain_prevention)
--   - Embeddings invalidation auto via UNIQUE(page_id, content_hash), cf
--     feedback expert improvement G
--
-- Toutes tables :
--   - RLS enabled (defense in depth, même si grants explicit)
--   - GRANT explicite service_role uniquement (anon BLOQUÉ par défaut),
--     cf MEMORY feedback_supabase_grant_explicit_for_new_projects
--   - Aucun anon grant, aucun authenticated grant côté R2 v2 (admin-only)
--
-- Volumétrie cible V2 (500K URLs) :
--   __seo_r2_pages           ~50MB (metadata légère)
--   __seo_r2_page_content    ~4.5GB TOAST compressed (JSONB séparé)
--   __seo_r2_metrics         ~150MB
--   __seo_r2_signatures      ~400MB (6 fingerprints + 5 LSH MinHash bands)
--   __seo_r2_embeddings      ~614MB + pgvector IVFFlat index
--   __seo_r2_composition_inputs  ~3GB (SoT replay)
--   __seo_r2_eligibility_log     ~200MB
--   __seo_r2_page_versions       ~6GB (INSERT-only, archives > 90j à Storage)
--   __seo_r2_qa_reviews          <100MB
--   __seo_r2_regeneration_queue  <50MB
--   Total : ~16GB sur base 221GB → 237GB (sous Supabase Pro 500GB)
--
-- Out of scope (différé à PR 2/V1.5) :
--   - BullMQ queue tables (les queues vivent dans Redis, pas Postgres)
--   - GSC observations table __seo_r2_gsc_observations
--   - r2-similarity-scan table __seo_r2_similarity_index (V2 nightly)
--
-- Squawk-validated. Tous les statements idempotents (IF NOT EXISTS).
-- =============================================================================

-- assume_in_transaction = true (cf .squawk.toml) : la migration tool wrap déjà
-- en transaction. Pas de BEGIN/COMMIT explicite ici (anti transaction-nesting warning).
-- SET LOCAL pour bornes de safety (squawk require-timeout-settings).
SET LOCAL lock_timeout       = '5s';
SET LOCAL statement_timeout  = '60s';

-- ── Préreq : pgvector extension pour embeddings ─────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- 1. __seo_r2_pages : metadata légère, hot (status, decision, scores synthétiques)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.__seo_r2_pages (
  id                          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pg_id                       INTEGER     NOT NULL,
  type_id                     INTEGER     NOT NULL,
  status                      TEXT        NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'review', 'rejected', 'regenerating', 'suppressed')),
  decision                    TEXT        NOT NULL DEFAULT 'noindex_follow'
    CHECK (decision IN ('index', 'noindex_follow', 'review_required', 'regenerate', 'reject', 'suppressed')),
  canonical_target_type_id    INTEGER,                    -- SUPPRESSED → pointe sibling INDEX, anti-chain enforced par Rego
  retry_count                 INTEGER     NOT NULL DEFAULT 0 CHECK (retry_count >= 0 AND retry_count <= 2),
  contract_version            TEXT        NOT NULL DEFAULT '2.0.0',
  content_hash                TEXT,                       -- sha256(content_main), NULL si pas encore INDEX
  eligibility_score           NUMERIC(5,2) CHECK (eligibility_score IS NULL OR (eligibility_score >= 0 AND eligibility_score <= 100)),
  generation_timestamp        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at                TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(pg_id, type_id)                                  -- improvement self-review : anti-chaos UNIQUE explicite
);

COMMENT ON TABLE public.__seo_r2_pages IS
  'ADR-066: R2 Content Composition v2 — metadata légère per (pg_id, type_id). Hot table : status/decision/scores synthétiques. Contenu lourd dans __seo_r2_page_content (FK), scores détaillés dans __seo_r2_metrics. canonical_target_type_id non-null seulement si decision=suppressed (validation Rego r2-content-write.rego invariant anti-chain).';
COMMENT ON COLUMN public.__seo_r2_pages.canonical_target_type_id IS
  'SUPPRESSED only : sibling type_id (même pg_id, decision=INDEX). Anti-chain + anti cross-gamme enforced par Rego policy r2-content-write.rego (cf ADR-066).';
COMMENT ON COLUMN public.__seo_r2_pages.eligibility_score IS
  'Score composite 0-100 calculé par R2EligibilityService AVANT compose. < THRESHOLD_V1 (=45) → STOP pipeline. THRESHOLD_V1 calibré empiriquement (scripts/audit/r2-eligibility-calibration.ts N=200 stratified).';

CREATE INDEX IF NOT EXISTS idx_r2_pages_status_decision
  ON public.__seo_r2_pages (status, decision)
  WHERE status IN ('published', 'review');

CREATE INDEX IF NOT EXISTS idx_r2_pages_canonical_target
  ON public.__seo_r2_pages (canonical_target_type_id)
  WHERE canonical_target_type_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_r2_pages_generation_timestamp
  ON public.__seo_r2_pages (generation_timestamp DESC);

ALTER TABLE public.__seo_r2_pages ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.__seo_r2_pages TO service_role;

-- =============================================================================
-- 2. __seo_r2_page_content : contenu JSONB lourd, tiède (TOAST compressed)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.__seo_r2_page_content (
  page_id     BIGINT      PRIMARY KEY REFERENCES public.__seo_r2_pages(id) ON DELETE CASCADE,
  content     JSONB       NOT NULL,                       -- 10 sections per R2PageContract
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.__seo_r2_page_content IS
  'ADR-066: contenu JSONB lourd R2 (10 sections : S_HERO, S_COMPAT_SCOPE, S_MOTOR_DELTA, S_SELECTION_GUIDE, S_PRODUCT_GROUPS, S_COMPAT_DETAIL, S_OEM_COMPACT, S_FAQ_SPECIFIC, S_REASSURANCE, S_RELATED_GUIDES). Table tiède (updates rares après INDEX), TOAST compressé. Séparée de __seo_r2_pages pour VACUUM/WAL isolés.';

ALTER TABLE public.__seo_r2_page_content ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.__seo_r2_page_content TO service_role;

-- =============================================================================
-- 3. __seo_r2_metrics : scores numériques détaillés, hot (mis à jour à chaque eval)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.__seo_r2_metrics (
  page_id                          BIGINT      PRIMARY KEY REFERENCES public.__seo_r2_pages(id) ON DELETE CASCADE,
  overall_seo_score                INTEGER     CHECK (overall_seo_score IS NULL OR (overall_seo_score >= 0 AND overall_seo_score <= 100)),
  motor_delta_score                INTEGER     CHECK (motor_delta_score IS NULL OR (motor_delta_score >= 0 AND motor_delta_score <= 100)),
  compat_delta_score               INTEGER     CHECK (compat_delta_score IS NULL OR (compat_delta_score >= 0 AND compat_delta_score <= 100)),
  commercial_distinctiveness_score INTEGER     CHECK (commercial_distinctiveness_score IS NULL OR (commercial_distinctiveness_score >= 0 AND commercial_distinctiveness_score <= 100)),
  crawl_value_score                INTEGER     CHECK (crawl_value_score IS NULL OR (crawl_value_score >= 0 AND crawl_value_score <= 100)),
  semantic_similarity_score        NUMERIC(4,3) CHECK (semantic_similarity_score IS NULL OR (semantic_similarity_score >= 0 AND semantic_similarity_score <= 1)),
  collision_risk_score             NUMERIC(4,3) CHECK (collision_risk_score IS NULL OR (collision_risk_score >= 0 AND collision_risk_score <= 1)),
  catalog_overlap_score            NUMERIC(4,3) CHECK (catalog_overlap_score IS NULL OR (catalog_overlap_score >= 0 AND catalog_overlap_score <= 1)),
  specific_block_count             INTEGER     CHECK (specific_block_count IS NULL OR specific_block_count >= 0),
  boilerplate_ratio                NUMERIC(4,3) CHECK (boilerplate_ratio IS NULL OR (boilerplate_ratio >= 0 AND boilerplate_ratio <= 1)),
  computed_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.__seo_r2_metrics IS
  'ADR-066: scores numériques R2 détaillés (overall, 4 eligibility subscores, 3 diversity scores, structure). Séparé de __seo_r2_pages pour permettre re-scoring sans toucher au content_hash (replay avec nouveau scoring 18 mois).';

ALTER TABLE public.__seo_r2_metrics ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.__seo_r2_metrics TO service_role;

-- =============================================================================
-- 4. __seo_r2_signatures : 6 fingerprints + 5 LSH MinHash bands (anti-duplicate)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.__seo_r2_signatures (
  page_id                  BIGINT      PRIMARY KEY REFERENCES public.__seo_r2_pages(id) ON DELETE CASCADE,
  content_fingerprint      TEXT        NOT NULL,          -- sha256(content_main)
  block_signature          TEXT        NOT NULL,          -- sha256(ordered block keys)
  faq_signature            TEXT        NOT NULL,          -- sha256(faq Q/A normalized)
  product_set_signature    TEXT        NOT NULL,          -- sha256(sorted product_ids)
  compatibility_signature  TEXT        NOT NULL,          -- sha256(compat scope normalized)
  catalog_signature        TEXT        NOT NULL,          -- sha256(sorted OEM + subgroups + family_counts) — early-gate diversity
  band_1                   TEXT        NOT NULL,          -- LSH MinHash band 1
  band_2                   TEXT        NOT NULL,
  band_3                   TEXT        NOT NULL,
  band_4                   TEXT        NOT NULL,
  band_5                   TEXT        NOT NULL,
  computed_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.__seo_r2_signatures IS
  'ADR-066: 6 fingerprints SHA-256 + 5 LSH MinHash bands pour anti-duplicate diversity gate. catalog_signature = early-gate structural-first (overlap > 0.92 → SUPPRESSED si sibling INDEX fiable, sinon REJECT). LSH bands pré-filtre avant pgvector cosine (cf MEMORY feedback_seo_catalog_signature_before_text_diversity).';

CREATE INDEX IF NOT EXISTS idx_r2_sig_catalog ON public.__seo_r2_signatures (catalog_signature);
CREATE INDEX IF NOT EXISTS idx_r2_sig_band_1  ON public.__seo_r2_signatures (band_1);
CREATE INDEX IF NOT EXISTS idx_r2_sig_band_2  ON public.__seo_r2_signatures (band_2);
CREATE INDEX IF NOT EXISTS idx_r2_sig_band_3  ON public.__seo_r2_signatures (band_3);
CREATE INDEX IF NOT EXISTS idx_r2_sig_band_4  ON public.__seo_r2_signatures (band_4);
CREATE INDEX IF NOT EXISTS idx_r2_sig_band_5  ON public.__seo_r2_signatures (band_5);

ALTER TABLE public.__seo_r2_signatures ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.__seo_r2_signatures TO service_role;

-- =============================================================================
-- 5. __seo_r2_embeddings : pgvector 1536d + content_hash UNIQUE (auto-invalidation)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.__seo_r2_embeddings (
  id            BIGINT GENERATED ALWAYS AS IDENTITY   PRIMARY KEY,
  page_id       BIGINT      NOT NULL REFERENCES public.__seo_r2_pages(id) ON DELETE CASCADE,
  content_hash  TEXT        NOT NULL,                     -- improvement G : link embedding au contenu, invalidation auto
  embedding     vector(1536) NOT NULL,                    -- text-embedding-3-small dimensions
  computed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(page_id, content_hash)                           -- 1 embedding par (page, contenu version)
);

COMMENT ON TABLE public.__seo_r2_embeddings IS
  'ADR-066: embeddings vectoriels pgvector(1536) text-embedding-3-small, indexés par (page_id, content_hash) — quand content_hash change, nouvelle ligne (anciennes embeddings non utilisées garbage-collected par job nightly future PR 2). Index IVFFlat V1.5, HNSW V2 (cf ADR-066 §rollout).';
COMMENT ON COLUMN public.__seo_r2_embeddings.content_hash IS
  'sha256(content_main) au moment du compute. Si content_main change → content_hash change → cosine queries lookup la nouvelle ligne, l ancienne est obsolète.';

-- IVFFlat index pour V1.5 (HNSW migration `CREATE INDEX CONCURRENTLY` à PR 3/V2).
-- lists=200 ≈ sqrt(100K clusters), recall ~95%, build time ~10s.
-- Note : index créé sans données = build instantané. À reconstruire si volume > 200K rows.
CREATE INDEX IF NOT EXISTS idx_r2_embeddings_cosine
  ON public.__seo_r2_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 200);

ALTER TABLE public.__seo_r2_embeddings ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.__seo_r2_embeddings TO service_role;

-- =============================================================================
-- 6. __seo_r2_composition_inputs : SoT replay-safe (snapshot input, pas content)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.__seo_r2_composition_inputs (
  pg_id                INTEGER     NOT NULL,
  type_id              INTEGER     NOT NULL,
  input_hash           TEXT        NOT NULL,              -- sha256(fast-json-stable-stringify(r1+r8+motor+cluster+catalog_signature))
  r1_signals           JSONB       NOT NULL,
  r8_signals           JSONB       NOT NULL,
  motor_delta          JSONB       NOT NULL,
  cluster_key          TEXT        NOT NULL,
  catalog_signature    TEXT        NOT NULL,
  captured_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (pg_id, type_id, input_hash),
  UNIQUE(pg_id, type_id, input_hash)                       -- explicite anti-doublon (improvement self-review)
);

COMMENT ON TABLE public.__seo_r2_composition_inputs IS
  'ADR-066: Source of Truth replay-safe — snapshot des inputs de composition (R1Signals + R8Signals + MotorDelta + Cluster + catalog_signature) avec hash déterministe via fast-json-stable-stringify (cf MEMORY feedback_deterministic_input_hash_canonical_json). Permet régénération 18 mois plus tard avec nouveau modèle/scoring SANS re-collecter R1+R8. Cible volume V2 ~3GB (smaller than content table car JSONB structuré sans texte généré).';
COMMENT ON COLUMN public.__seo_r2_composition_inputs.input_hash IS
  'sha256(fast-json-stable-stringify({r1, r8, motor, cluster, catalog_signature})) — clés triées, no whitespace. JAMAIS JSON.stringify natif (clés non ordonnées = bug silencieux). cf feedback expert improvement C.';

CREATE INDEX IF NOT EXISTS idx_r2_inputs_cluster_key ON public.__seo_r2_composition_inputs (cluster_key);
CREATE INDEX IF NOT EXISTS idx_r2_inputs_captured    ON public.__seo_r2_composition_inputs (captured_at DESC);

ALTER TABLE public.__seo_r2_composition_inputs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.__seo_r2_composition_inputs TO service_role;
-- No UPDATE grant : inputs sont immuables une fois snapshot (replay safety)

-- =============================================================================
-- 7. __seo_r2_eligibility_log : audit trail décisions eligibility (avant compose)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.__seo_r2_eligibility_log (
  id                BIGINT GENERATED ALWAYS AS IDENTITY   PRIMARY KEY,
  pg_id             INTEGER     NOT NULL,
  type_id           INTEGER     NOT NULL,
  attempt           INTEGER     NOT NULL DEFAULT 1,
  eligibility_score NUMERIC(5,2) NOT NULL CHECK (eligibility_score >= 0 AND eligibility_score <= 100),
  subscores         JSONB       NOT NULL,                 -- { motor, compat, commercial, crawl }
  verdict           TEXT        NOT NULL CHECK (verdict IN ('eligible', 'suppressed', 'reject')),
  suppressed_target INTEGER,                              -- si verdict=suppressed, sibling type_id
  reason            TEXT,
  evaluated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.__seo_r2_eligibility_log IS
  'ADR-066: audit trail complet des décisions eligibility (GATE 1 avant compose/LLM). Persiste chaque évaluation avec subscores motor/compat/commercial/crawl. Permet calibration empirique (scripts/audit/r2-eligibility-calibration.ts) + forensic post-hoc.';

CREATE INDEX IF NOT EXISTS idx_r2_elig_log_pg_type ON public.__seo_r2_eligibility_log (pg_id, type_id);
CREATE INDEX IF NOT EXISTS idx_r2_elig_log_verdict ON public.__seo_r2_eligibility_log (verdict);
CREATE INDEX IF NOT EXISTS idx_r2_elig_log_evaluated ON public.__seo_r2_eligibility_log (evaluated_at DESC);

ALTER TABLE public.__seo_r2_eligibility_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.__seo_r2_eligibility_log TO service_role;

-- =============================================================================
-- 8. __seo_r2_page_versions : INSERT-only, snapshots tar.zst (versioning replay)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.__seo_r2_page_versions (
  id                BIGINT GENERATED ALWAYS AS IDENTITY   PRIMARY KEY,
  pg_id             INTEGER     NOT NULL,
  type_id           INTEGER     NOT NULL,
  version_sha       TEXT        NOT NULL UNIQUE,          -- sha256 du tar.zst
  tar_path          TEXT        NOT NULL,                 -- chemin filesystem ou Storage URL
  contract_version  TEXT        NOT NULL,
  builder_version   TEXT        NOT NULL,                 -- 5 version fields per replay-and-versioning-rules
  pipeline_version  TEXT        NOT NULL,
  extractor_version TEXT        NOT NULL,
  runner_version    TEXT        NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.__seo_r2_page_versions IS
  'ADR-066 + replay-and-versioning-rules canon : versioning INSERT-only des snapshots R2. Chaque INDEX/SUPPRESSED transition produit un tar.zst avec chattr +i (immutable filesystem flag), sha256 stocké. Archive > 90j → Supabase Storage (PR 3 V2). 5 version fields obligatoires.';

CREATE INDEX IF NOT EXISTS idx_r2_versions_pg_type ON public.__seo_r2_page_versions (pg_id, type_id, created_at DESC);

ALTER TABLE public.__seo_r2_page_versions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.__seo_r2_page_versions TO service_role;
-- No UPDATE/DELETE grant : versions immuables (replay-and-versioning-rules)

-- =============================================================================
-- 9. __seo_r2_qa_reviews : audit trail decisions governance gate
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.__seo_r2_qa_reviews (
  id              BIGINT GENERATED ALWAYS AS IDENTITY   PRIMARY KEY,
  pg_id           INTEGER     NOT NULL,
  type_id         INTEGER     NOT NULL,
  decision        TEXT        NOT NULL CHECK (decision IN ('index', 'suppressed', 'review_required', 'regenerate', 'reject')),
  reasons         TEXT[]      NOT NULL DEFAULT '{}',      -- raisons Rego deny + autres
  reviewer        TEXT,                                    -- NULL = automatique, non-NULL = human actor
  reviewed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  score_snapshot  JSONB                                    -- copie figée des metrics au moment de la décision
);

COMMENT ON TABLE public.__seo_r2_qa_reviews IS
  'ADR-066: audit trail des décisions governance gate (R2GovernanceGate). reviewer NULL = decision automatique pipeline. reviewer non-NULL = override humain via admin UI review queue (PR 2 V1.5).';

CREATE INDEX IF NOT EXISTS idx_r2_qa_pg_type   ON public.__seo_r2_qa_reviews (pg_id, type_id, reviewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_r2_qa_decision  ON public.__seo_r2_qa_reviews (decision);
CREATE INDEX IF NOT EXISTS idx_r2_qa_reviewer  ON public.__seo_r2_qa_reviews (reviewer) WHERE reviewer IS NOT NULL;

ALTER TABLE public.__seo_r2_qa_reviews ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.__seo_r2_qa_reviews TO service_role;

-- =============================================================================
-- 10. __seo_r2_regeneration_queue : queue Postgres-backed pour REGENERATE retries
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.__seo_r2_regeneration_queue (
  id              BIGINT GENERATED ALWAYS AS IDENTITY   PRIMARY KEY,
  pg_id           INTEGER     NOT NULL,
  type_id         INTEGER     NOT NULL,
  reason          TEXT        NOT NULL,
  retry_count     INTEGER     NOT NULL DEFAULT 0 CHECK (retry_count >= 0 AND retry_count <= 2),
  queued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ,
  UNIQUE(pg_id, type_id)                                   -- 1 pending regen max par page (pas de duplication queue)
);

COMMENT ON TABLE public.__seo_r2_regeneration_queue IS
  'ADR-066: queue Postgres-backed pour REGENERATE retries (decision regenerate du governance gate). UNIQUE(pg_id, type_id) empêche doublons. Consommé par BullMQ processor PR 2 V1.5. Cleanup processed_at > 30j (job nightly future).';

CREATE INDEX IF NOT EXISTS idx_r2_regen_queue_pending
  ON public.__seo_r2_regeneration_queue (queued_at)
  WHERE processed_at IS NULL;

ALTER TABLE public.__seo_r2_regeneration_queue ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.__seo_r2_regeneration_queue TO service_role;

-- =============================================================================
-- updated_at triggers (idempotent pattern)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.__seo_r2_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_r2_pages_updated_at ON public.__seo_r2_pages;
CREATE TRIGGER trg_r2_pages_updated_at
  BEFORE UPDATE ON public.__seo_r2_pages
  FOR EACH ROW EXECUTE FUNCTION public.__seo_r2_set_updated_at();

DROP TRIGGER IF EXISTS trg_r2_page_content_updated_at ON public.__seo_r2_page_content;
CREATE TRIGGER trg_r2_page_content_updated_at
  BEFORE UPDATE ON public.__seo_r2_page_content
  FOR EACH ROW EXECUTE FUNCTION public.__seo_r2_set_updated_at();

-- No COMMIT — migration tool manages the transaction (assume_in_transaction).
