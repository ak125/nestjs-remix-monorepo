-- squawk-ignore-file prefer-identity
-- squawk-ignore-file prefer-bigint-over-int
-- Justification des ignores (mêmes règles et même raison que
-- 20261011_diag_capture_maintenance_schema.sql) : prefer-identity vise les 6
-- `id serial`, prefer-bigint-over-int les colonnes integer. Ces règles visent la
-- conception de NOUVELLES tables ; ici les 6 tables existent déjà en base en
-- serial/integer. Sur la base partagée, IF NOT EXISTS les laisse telles quelles, et
-- écrire identity ou bigint ferait mentir la capture (la post-condition du § 8 ne
-- décrit qu'une forme, celle de la base). Changer le type d'une colonne serait un
-- ALTER distinct, hors de cette capture.
-- =============================================================================
-- Migration : versionner le schéma des 6 tables vidéo de media-factory
-- Date      : 2026-10-31
-- Severity  : LOW (aucun changement de schéma sur la base partagée ; aucune donnée
--             lue ni écrite, aucun droit modifié, aucune politique RLS touchée)
-- Scope     : public.__video_execution_log, public.__video_productions,
--             public.__video_variants, public.__video_assets,
--             public.__video_audio_cache, public.__video_templates, présentes en
--             base sans CREATE dans le dépôt.
-- Refs      : convention de capture de 20261011_diag_capture_maintenance_schema.sql ;
--             20260930_rls_align_service_role_only_policies.sql (exige
--             __video_execution_log présente, RLS active).
-- Forward-only. Ne réécrit AUCUNE migration historique.
-- Application : acte owner (base partagée DEV / PREPROD / PROD).
-- =============================================================================
--
-- MESURE (lecture seule, 2026-10-31)
-- ----------------------------------
-- 6 tables `__video_*` en base, aucune n'a de CREATE dans ce répertoire ; toutes
-- sont lues ou écrites par le module media-factory (video-data, video-job,
-- video-gates, script-generator, tts, audio-cache, postprocess,
-- derivative-engine, template-registry) ou par le processeur
-- video-execution. Lignes : execution_log 9, productions 2, audio_cache 1,
-- variants 0, assets 0, templates 0. Aucun trigger, aucune vue dépendante, aucune
-- colonne identity ni générée, aucun héritage. Les deux fichiers de types du dépôt
-- (backend/src/database/types/database.types.ts,
-- packages/database-types/src/supabase-generated.types.ts) décrivent déjà ces
-- colonnes ; quality_score y est `number | null`, nullable comme en base.
--
-- CAPTURE
-- -------
-- DDL relevé dans le catalogue de la base (pg_attribute, pg_attrdef,
-- pg_constraint, pg_index, pg_sequence, descriptions), recopié tel quel :
--   * `serial` = séquence integer possédée par la colonne (start 1, increment 1,
--     max 2147483647, cache 1, sans cycle), exactement l'objet en base ;
--   * contraintes déclarées en ligne : PostgreSQL leur donne ses noms par défaut,
--     qui sont ceux de la base (…_pkey, …_brief_id_key, …_status_check,
--     …_execution_log_id_fkey, …) ;
--   * les CHECK s'écrivent `IN (…)`, que PostgreSQL range sous la forme
--     `= ANY (ARRAY[…])` relevée en base ;
--   * ordre des colonnes = ordre en base (attnum) ; ordre des tables = ordre des
--     clés étrangères (__video_variants référence __video_execution_log).
--
-- RLS ET DROITS
-- -------------
-- Les 6 tables ont la RLS active en base, chacune avec une politique service_role
-- (ALL, true). Seule __video_execution_log est déjà touchée par une migration
-- (20260930). La capture n'exécute `ENABLE ROW LEVEL SECURITY` (§ 7) que sur une
-- table où la RLS est inactive : sur la base partagée elle est active partout, la
-- capture ne l'exécute pas et ne prend aucun verrou ACCESS EXCLUSIVE ; sur une
-- base vierge, une table créée sans elle serait ouverte à anon et authenticated
-- par les privilèges par défaut. Elle ne crée ni ne modifie AUCUNE politique
-- (service_role a BYPASSRLS : sa politique ne change pas son accès ; versionner les
-- 6 politiques est un acte RLS distinct) et aucun droit (GRANT/REVOKE : les droits
-- de table et de séquence restent ceux de la base). La post-condition refuse en
-- revanche toute politique qui viserait un autre rôle que service_role.
--
-- DATE
-- ----
-- Datée du jour de la capture, jamais antidatée : le moteur applique toute
-- migration locale absente du ledger, et un rejeu depuis une base vide est
-- impossible par construction (20260930 refuse de s'appliquer sans
-- __video_execution_log, et d'autres tables legacy n'ont pas de CREATE au dépôt).
--
-- EFFET ATTENDU SUR LA BASE PARTAGÉE : aucun changement de schéma. La
-- pré-condition (§ 0) n'accepte que 0 table (base vierge) ou les 6 : une table
-- absente sur une base où les autres existent signale une perte, que recréer vide
-- masquerait. Chaque instruction est IF NOT EXISTS, COMMENT ON réécrit le texte
-- identique, ENABLE ROW LEVEL SECURITY n'est pas exécuté ; puis la post-condition
-- compare la forme réelle (colonnes, défauts, commentaires, contraintes, index et
-- leur validité, séquences, RLS, triggers et règles non internes, politiques hors
-- service_role) à la forme capturée et lève une exception à la moindre
-- différence : une base qui a dérivé depuis la capture fait échouer l'application
-- (transaction annulée) au lieu d'enregistrer comme appliquée une capture fausse.
-- Trois écarts ne sont PAS refusés, parce que la post-condition passe après les
-- instructions qui les corrigent : un des 3 commentaires capturés modifié (COMMENT
-- ON le réécrit), une RLS désactivée (ENABLE la réactive), un des 16 index absent
-- (CREATE INDEX IF NOT EXISTS le recrée). Ils sont ramenés à la forme capturée,
-- comportement épinglé par scripts/db/test-video-capture-media-factory-schema.sh
-- (§ 5). Une RLS forcée, une politique, un droit ou une donnée ne sont jamais
-- écrits.
-- =============================================================================

-- Le moteur enveloppe le fichier dans une transaction (.squawk.toml
-- `assume_in_transaction = true`) : SET LOCAL borne les verrous de cette
-- transaction seulement. Même quand l'index existe, CREATE INDEX IF NOT EXISTS
-- prend un verrou SHARE sur sa table (écritures bloquées, lectures permises),
-- gardé jusqu'au COMMIT (quelques millisecondes : le reste n'est que lecture du
-- catalogue). lock_timeout borne chaque attente, pas leur somme : 4 tables portent
-- des index, donc au pire 3 attentes successives pendant que les premières restent
-- en SHARE. ENABLE ROW LEVEL SECURITY (ACCESS EXCLUSIVE) n'est exécuté que sur une
-- table où la RLS est inactive (§ 7).
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- -----------------------------------------------------------------------------
-- 0) Pré-condition : 0 table (base vierge) ou les 6, jamais un état partiel.
-- -----------------------------------------------------------------------------
DO $precheck$
DECLARE
  v_present text[];
  v_absent  text[];
BEGIN
  SELECT array_agg(t ORDER BY t COLLATE "C") FILTER (WHERE to_regclass('public.' || t) IS NOT NULL),
         array_agg(t ORDER BY t COLLATE "C") FILTER (WHERE to_regclass('public.' || t) IS NULL)
    INTO v_present, v_absent
    FROM unnest(ARRAY['__video_execution_log', '__video_productions', '__video_variants',
                      '__video_assets', '__video_audio_cache', '__video_templates']) AS t;

  IF v_present IS NOT NULL AND v_absent IS NOT NULL THEN
    RAISE EXCEPTION 'ABORT: état partiel des tables __video_* : présentes %, absentes %',
                    v_present, v_absent
      USING HINT = 'Une table absente là où les autres existent signale une perte : la restaurer, ne pas la recréer vide.';
  END IF;

  RAISE NOTICE 'capture __video_* : % table(s) présente(s) sur 6', coalesce(cardinality(v_present), 0);
END
$precheck$;

-- -----------------------------------------------------------------------------
-- 1) __video_execution_log (9 lignes au 2026-10-31)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.__video_execution_log (
  id                      serial PRIMARY KEY,
  brief_id                text NOT NULL,
  video_type              text NOT NULL,
  vertical                text NOT NULL,
  gamme_alias             text,
  pg_id                   integer,
  status                  varchar NOT NULL DEFAULT 'pending',
  bullmq_job_id           varchar,
  trigger_source          varchar NOT NULL,
  trigger_job_id          varchar,
  created_at              timestamptz DEFAULT now(),
  started_at              timestamptz,
  completed_at            timestamptz,
  artefact_check          jsonb,
  gate_results            jsonb,
  can_publish             boolean,
  quality_score           integer,
  quality_flags           jsonb,
  error_message           text,
  duration_ms             integer,
  attempt_number          integer DEFAULT 1,
  feature_flags           jsonb,
  engine_name             text,
  engine_version          text,
  render_status           text,
  render_output_path      text,
  render_metadata         jsonb,
  render_duration_ms      integer,
  render_error_code       text,
  engine_resolution       text,
  retryable               boolean DEFAULT false,
  is_canary               boolean DEFAULT false,
  canary_fallback         boolean DEFAULT false,
  canary_error_message    text,
  canary_error_code       text,
  tts_audio_url           text,
  tts_duration_secs       numeric(6,2),
  tts_cached              boolean DEFAULT false,
  tts_cost_chars          integer,
  postprocess_variants    jsonb,
  postprocess_duration_ms integer,
  srt_s3_path             text,
  parent_brief_id         text,
  derivative_index        integer,
  batch_id                text
);

-- INDEX: idx_vel_brief_id (existe déjà en base : capturé, pas créé)
-- Table: public.__video_execution_log (9 lignes au 2026-10-31)
-- Pattern: btree (brief_id)
--   (usage par le code non re-mesuré ici)
-- Gain attendu: aucun nouveau, l'index est recopié tel quel
-- RPC concernees: aucune (lecture PostgREST du backend, service_role)
CREATE INDEX IF NOT EXISTS idx_vel_brief_id
  ON public.__video_execution_log USING btree (brief_id);

-- INDEX: idx_vel_bullmq_job (existe déjà en base : capturé, pas créé)
-- Table: public.__video_execution_log (9 lignes au 2026-10-31)
-- Pattern: btree (bullmq_job_id) WHERE (bullmq_job_id IS NOT NULL)
--   (usage par le code non re-mesuré ici)
-- Gain attendu: aucun nouveau, l'index est recopié tel quel
-- RPC concernees: aucune (lecture PostgREST du backend, service_role)
CREATE INDEX IF NOT EXISTS idx_vel_bullmq_job
  ON public.__video_execution_log USING btree (bullmq_job_id) WHERE (bullmq_job_id IS NOT NULL);

-- INDEX: idx_vel_canary (existe déjà en base : capturé, pas créé)
-- Table: public.__video_execution_log (9 lignes au 2026-10-31)
-- Pattern: btree (is_canary, engine_name, created_at DESC) WHERE (is_canary = true)
--   (usage par le code non re-mesuré ici)
-- Gain attendu: aucun nouveau, l'index est recopié tel quel
-- RPC concernees: aucune (lecture PostgREST du backend, service_role)
CREATE INDEX IF NOT EXISTS idx_vel_canary
  ON public.__video_execution_log USING btree (is_canary, engine_name, created_at DESC)
  WHERE (is_canary = true);

-- INDEX: idx_vel_created_at (existe déjà en base : capturé, pas créé)
-- Table: public.__video_execution_log (9 lignes au 2026-10-31)
-- Pattern: btree (created_at DESC)
--   (usage par le code non re-mesuré ici)
-- Gain attendu: aucun nouveau, l'index est recopié tel quel
-- RPC concernees: aucune (lecture PostgREST du backend, service_role)
CREATE INDEX IF NOT EXISTS idx_vel_created_at
  ON public.__video_execution_log USING btree (created_at DESC);

-- INDEX: idx_vel_status (existe déjà en base : capturé, pas créé)
-- Table: public.__video_execution_log (9 lignes au 2026-10-31)
-- Pattern: btree (status)
--   (usage par le code non re-mesuré ici)
-- Gain attendu: aucun nouveau, l'index est recopié tel quel
-- RPC concernees: aucune (lecture PostgREST du backend, service_role)
CREATE INDEX IF NOT EXISTS idx_vel_status
  ON public.__video_execution_log USING btree (status);

-- INDEX: idx_vel_vertical (existe déjà en base : capturé, pas créé)
-- Table: public.__video_execution_log (9 lignes au 2026-10-31)
-- Pattern: btree (vertical)
--   (usage par le code non re-mesuré ici)
-- Gain attendu: aucun nouveau, l'index est recopié tel quel
-- RPC concernees: aucune (lecture PostgREST du backend, service_role)
CREATE INDEX IF NOT EXISTS idx_vel_vertical
  ON public.__video_execution_log USING btree (vertical);

-- INDEX: idx_video_exec_batch (existe déjà en base : capturé, pas créé)
-- Table: public.__video_execution_log (9 lignes au 2026-10-31)
-- Pattern: btree (batch_id) WHERE (batch_id IS NOT NULL)
--   (usage par le code non re-mesuré ici)
-- Gain attendu: aucun nouveau, l'index est recopié tel quel
-- RPC concernees: aucune (lecture PostgREST du backend, service_role)
CREATE INDEX IF NOT EXISTS idx_video_exec_batch
  ON public.__video_execution_log USING btree (batch_id) WHERE (batch_id IS NOT NULL);

COMMENT ON COLUMN public.__video_execution_log.render_error_code IS
  'P4.0 RenderErrorCode enum value. NULL = success or not yet rendered.';
COMMENT ON COLUMN public.__video_execution_log.engine_resolution IS
  'P4.1.x: requested | fallback_to_stub';
COMMENT ON COLUMN public.__video_execution_log.retryable IS
  'P4.1.x: whether this failed execution can be retried';

-- -----------------------------------------------------------------------------
-- 2) __video_productions (2 lignes au 2026-10-31)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.__video_productions (
  id                   serial PRIMARY KEY,
  brief_id             text NOT NULL UNIQUE,
  video_type           text NOT NULL CHECK (video_type IN ('film_socle', 'film_gamme', 'short')),
  vertical             text NOT NULL,
  gamme_alias          text,
  pg_id                integer,
  status               text NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft', 'pending_review', 'script_approved',
                                           'storyboard', 'rendering', 'qa', 'qa_failed',
                                           'ready_for_publish', 'published', 'archived')),
  template_id          text,
  knowledge_contract   jsonb,
  claim_table          jsonb,
  evidence_pack        jsonb,
  disclaimer_plan      jsonb,
  approval_record      jsonb,
  quality_score        integer,
  quality_flags        text[],
  gate_results         jsonb,
  created_by           text NOT NULL DEFAULT 'system',
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now(),
  script_text          text,
  script_generated_at  timestamptz,
  script_model         text,
  narrative_style_pack jsonb,
  derivative_policy    jsonb,
  master_audio_url     text,
  tts_voice            text,
  tts_speed            numeric(3,2),
  parent_brief_id      text,
  derivative_index     integer,
  content_role         text DEFAULT 'master_truth'
);

-- INDEX: idx_video_prod_created (existe déjà en base : capturé, pas créé)
-- Table: public.__video_productions (2 lignes au 2026-10-31)
-- Pattern: btree (created_at)
--   (usage par le code non re-mesuré ici)
-- Gain attendu: aucun nouveau, l'index est recopié tel quel
-- RPC concernees: aucune (lecture PostgREST du backend, service_role)
CREATE INDEX IF NOT EXISTS idx_video_prod_created
  ON public.__video_productions USING btree (created_at);

-- INDEX: idx_video_prod_pg_id (existe déjà en base : capturé, pas créé)
-- Table: public.__video_productions (2 lignes au 2026-10-31)
-- Pattern: btree (pg_id)
--   (usage par le code non re-mesuré ici)
-- Gain attendu: aucun nouveau, l'index est recopié tel quel
-- RPC concernees: aucune (lecture PostgREST du backend, service_role)
CREATE INDEX IF NOT EXISTS idx_video_prod_pg_id
  ON public.__video_productions USING btree (pg_id);

-- INDEX: idx_video_prod_status (existe déjà en base : capturé, pas créé)
-- Table: public.__video_productions (2 lignes au 2026-10-31)
-- Pattern: btree (status)
--   (usage par le code non re-mesuré ici)
-- Gain attendu: aucun nouveau, l'index est recopié tel quel
-- RPC concernees: aucune (lecture PostgREST du backend, service_role)
CREATE INDEX IF NOT EXISTS idx_video_prod_status
  ON public.__video_productions USING btree (status);

-- INDEX: idx_video_prod_template (existe déjà en base : capturé, pas créé)
-- Table: public.__video_productions (2 lignes au 2026-10-31)
-- Pattern: btree (template_id)
--   (usage par le code non re-mesuré ici)
-- Gain attendu: aucun nouveau, l'index est recopié tel quel
-- RPC concernees: aucune (lecture PostgREST du backend, service_role)
CREATE INDEX IF NOT EXISTS idx_video_prod_template
  ON public.__video_productions USING btree (template_id);

-- INDEX: idx_video_prod_vertical (existe déjà en base : capturé, pas créé)
-- Table: public.__video_productions (2 lignes au 2026-10-31)
-- Pattern: btree (vertical)
--   (usage par le code non re-mesuré ici)
-- Gain attendu: aucun nouveau, l'index est recopié tel quel
-- RPC concernees: aucune (lecture PostgREST du backend, service_role)
CREATE INDEX IF NOT EXISTS idx_video_prod_vertical
  ON public.__video_productions USING btree (vertical);

-- INDEX: idx_video_productions_parent (existe déjà en base : capturé, pas créé)
-- Table: public.__video_productions (2 lignes au 2026-10-31)
-- Pattern: btree (parent_brief_id) WHERE (parent_brief_id IS NOT NULL)
--   (usage par le code non re-mesuré ici)
-- Gain attendu: aucun nouveau, l'index est recopié tel quel
-- RPC concernees: aucune (lecture PostgREST du backend, service_role)
CREATE INDEX IF NOT EXISTS idx_video_productions_parent
  ON public.__video_productions USING btree (parent_brief_id) WHERE (parent_brief_id IS NOT NULL);

-- -----------------------------------------------------------------------------
-- 3) __video_variants (0 ligne au 2026-10-31)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.__video_variants (
  id               serial PRIMARY KEY,
  execution_log_id integer REFERENCES public.__video_execution_log (id),
  brief_id         text NOT NULL,
  variant_name     text NOT NULL,
  s3_path          text NOT NULL,
  codec            text NOT NULL,
  resolution       text NOT NULL,
  file_size_bytes  bigint,
  duration_secs    numeric(8,2),
  loudness_lufs    numeric(5,2),
  created_at       timestamptz DEFAULT now(),
  UNIQUE (execution_log_id, variant_name)
);

-- INDEX: idx_video_variants_brief (existe déjà en base : capturé, pas créé)
-- Table: public.__video_variants (0 ligne au 2026-10-31)
-- Pattern: btree (brief_id)
--   (usage par le code non re-mesuré ici)
-- Gain attendu: aucun nouveau, l'index est recopié tel quel
-- RPC concernees: aucune (lecture PostgREST du backend, service_role)
CREATE INDEX IF NOT EXISTS idx_video_variants_brief
  ON public.__video_variants USING btree (brief_id);

-- -----------------------------------------------------------------------------
-- 4) __video_assets (0 ligne au 2026-10-31)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.__video_assets (
  id               serial PRIMARY KEY,
  asset_key        text NOT NULL UNIQUE,
  visual_type      text NOT NULL
                     CHECK (visual_type IN ('schema', 'animation', 'macro', 'motion_text',
                                            'ambiance', 'photo_reelle')),
  truth_dependency text NOT NULL DEFAULT 'illustration'
                     CHECK (truth_dependency IN ('illustration', 'proof', 'reference')),
  tags             text[],
  file_path        text,
  validated        boolean DEFAULT false,
  validated_by     text,
  created_at       timestamptz DEFAULT now()
);

-- INDEX: idx_video_assets_validated (existe déjà en base : capturé, pas créé)
-- Table: public.__video_assets (0 ligne au 2026-10-31)
-- Pattern: btree (validated) WHERE (validated = true)
--   (usage par le code non re-mesuré ici)
-- Gain attendu: aucun nouveau, l'index est recopié tel quel
-- RPC concernees: aucune (lecture PostgREST du backend, service_role)
CREATE INDEX IF NOT EXISTS idx_video_assets_validated
  ON public.__video_assets USING btree (validated) WHERE (validated = true);

-- INDEX: idx_video_assets_visual_type (existe déjà en base : capturé, pas créé)
-- Table: public.__video_assets (0 ligne au 2026-10-31)
-- Pattern: btree (visual_type)
--   (usage par le code non re-mesuré ici)
-- Gain attendu: aucun nouveau, l'index est recopié tel quel
-- RPC concernees: aucune (lecture PostgREST du backend, service_role)
CREATE INDEX IF NOT EXISTS idx_video_assets_visual_type
  ON public.__video_assets USING btree (visual_type);

-- -----------------------------------------------------------------------------
-- 5) __video_audio_cache (1 ligne au 2026-10-31)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.__video_audio_cache (
  id            serial PRIMARY KEY,
  cache_key     text NOT NULL UNIQUE,
  url           text NOT NULL,
  duration_secs numeric(6,2),
  voice         text NOT NULL,
  speed         numeric(3,2) NOT NULL,
  char_count    integer NOT NULL,
  created_at    timestamptz DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 6) __video_templates (0 ligne au 2026-10-31)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.__video_templates (
  id                  serial PRIMARY KEY,
  template_id         text NOT NULL UNIQUE,
  version             integer NOT NULL DEFAULT 1,
  video_type          text NOT NULL CHECK (video_type IN ('film_socle', 'film_gamme', 'short')),
  platform            text NOT NULL
                        CHECK (platform IN ('youtube_long', 'youtube_short', 'instagram_reel',
                                            'tiktok', 'linkedin')),
  allowed_use_cases   text[],
  forbidden_use_cases text[],
  duration_range      int4range,
  structure           jsonb,
  created_at          timestamptz DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 7) RLS : déjà active en base sur les 6 tables (voir l'en-tête, « RLS ET DROITS »).
--    Activée seulement là où elle est inactive : aucun verrou ACCESS EXCLUSIVE
--    sur une table déjà conforme.
-- -----------------------------------------------------------------------------
DO $rls$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_catalog.pg_class
           WHERE oid = 'public.__video_execution_log'::regclass) THEN
    ALTER TABLE public.__video_execution_log ENABLE ROW LEVEL SECURITY;
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_catalog.pg_class
           WHERE oid = 'public.__video_productions'::regclass) THEN
    ALTER TABLE public.__video_productions ENABLE ROW LEVEL SECURITY;
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_catalog.pg_class
           WHERE oid = 'public.__video_variants'::regclass) THEN
    ALTER TABLE public.__video_variants ENABLE ROW LEVEL SECURITY;
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_catalog.pg_class
           WHERE oid = 'public.__video_assets'::regclass) THEN
    ALTER TABLE public.__video_assets ENABLE ROW LEVEL SECURITY;
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_catalog.pg_class
           WHERE oid = 'public.__video_audio_cache'::regclass) THEN
    ALTER TABLE public.__video_audio_cache ENABLE ROW LEVEL SECURITY;
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_catalog.pg_class
           WHERE oid = 'public.__video_templates'::regclass) THEN
    ALTER TABLE public.__video_templates ENABLE ROW LEVEL SECURITY;
  END IF;
END
$rls$;

-- -----------------------------------------------------------------------------
-- 8) Post-condition : forme réelle == forme capturée, sinon la transaction échoue.
--    Le rendu du catalogue (pg_get_expr, pg_get_constraintdef, regclass) dépend
--    du search_path : il est fixé pendant la mesure puis restauré. Le tri est en
--    collation "C" pour ne pas dépendre de la locale de la base.
--    Un index invalide (création interrompue) est marqué « (invalide) ». Trigger,
--    règle ou politique hors service_role n'ont aucune ligne attendue : en base
--    il n'y a que les triggers internes des clés étrangères, aucune règle, et une
--    politique par table, TO service_role.
-- -----------------------------------------------------------------------------
DO $postcheck$
DECLARE
  v_search_path text := current_setting('search_path');
  v_tables      regclass[];
  v_actual      text;
  -- Forme de la base relevée le 2026-10-31 par cette même requête (lecture seule),
  -- une ligne par objet, triée en collation "C".
  v_expected    constant text := btrim($expected$
column __video_assets.asset_key text not null
column __video_assets.created_at timestamp with time zone default now()
column __video_assets.file_path text
column __video_assets.id integer not null default nextval('__video_assets_id_seq'::regclass)
column __video_assets.tags text[]
column __video_assets.truth_dependency text not null default 'illustration'::text
column __video_assets.validated boolean default false
column __video_assets.validated_by text
column __video_assets.visual_type text not null
column __video_audio_cache.cache_key text not null
column __video_audio_cache.char_count integer not null
column __video_audio_cache.created_at timestamp with time zone default now()
column __video_audio_cache.duration_secs numeric(6,2)
column __video_audio_cache.id integer not null default nextval('__video_audio_cache_id_seq'::regclass)
column __video_audio_cache.speed numeric(3,2) not null
column __video_audio_cache.url text not null
column __video_audio_cache.voice text not null
column __video_execution_log.artefact_check jsonb
column __video_execution_log.attempt_number integer default 1
column __video_execution_log.batch_id text
column __video_execution_log.brief_id text not null
column __video_execution_log.bullmq_job_id character varying
column __video_execution_log.can_publish boolean
column __video_execution_log.canary_error_code text
column __video_execution_log.canary_error_message text
column __video_execution_log.canary_fallback boolean default false
column __video_execution_log.completed_at timestamp with time zone
column __video_execution_log.created_at timestamp with time zone default now()
column __video_execution_log.derivative_index integer
column __video_execution_log.duration_ms integer
column __video_execution_log.engine_name text
column __video_execution_log.engine_resolution text comment P4.1.x: requested | fallback_to_stub
column __video_execution_log.engine_version text
column __video_execution_log.error_message text
column __video_execution_log.feature_flags jsonb
column __video_execution_log.gamme_alias text
column __video_execution_log.gate_results jsonb
column __video_execution_log.id integer not null default nextval('__video_execution_log_id_seq'::regclass)
column __video_execution_log.is_canary boolean default false
column __video_execution_log.parent_brief_id text
column __video_execution_log.pg_id integer
column __video_execution_log.postprocess_duration_ms integer
column __video_execution_log.postprocess_variants jsonb
column __video_execution_log.quality_flags jsonb
column __video_execution_log.quality_score integer
column __video_execution_log.render_duration_ms integer
column __video_execution_log.render_error_code text comment P4.0 RenderErrorCode enum value. NULL = success or not yet rendered.
column __video_execution_log.render_metadata jsonb
column __video_execution_log.render_output_path text
column __video_execution_log.render_status text
column __video_execution_log.retryable boolean default false comment P4.1.x: whether this failed execution can be retried
column __video_execution_log.srt_s3_path text
column __video_execution_log.started_at timestamp with time zone
column __video_execution_log.status character varying not null default 'pending'::character varying
column __video_execution_log.trigger_job_id character varying
column __video_execution_log.trigger_source character varying not null
column __video_execution_log.tts_audio_url text
column __video_execution_log.tts_cached boolean default false
column __video_execution_log.tts_cost_chars integer
column __video_execution_log.tts_duration_secs numeric(6,2)
column __video_execution_log.vertical text not null
column __video_execution_log.video_type text not null
column __video_productions.approval_record jsonb
column __video_productions.brief_id text not null
column __video_productions.claim_table jsonb
column __video_productions.content_role text default 'master_truth'::text
column __video_productions.created_at timestamp with time zone default now()
column __video_productions.created_by text not null default 'system'::text
column __video_productions.derivative_index integer
column __video_productions.derivative_policy jsonb
column __video_productions.disclaimer_plan jsonb
column __video_productions.evidence_pack jsonb
column __video_productions.gamme_alias text
column __video_productions.gate_results jsonb
column __video_productions.id integer not null default nextval('__video_productions_id_seq'::regclass)
column __video_productions.knowledge_contract jsonb
column __video_productions.master_audio_url text
column __video_productions.narrative_style_pack jsonb
column __video_productions.parent_brief_id text
column __video_productions.pg_id integer
column __video_productions.quality_flags text[]
column __video_productions.quality_score integer
column __video_productions.script_generated_at timestamp with time zone
column __video_productions.script_model text
column __video_productions.script_text text
column __video_productions.status text not null default 'draft'::text
column __video_productions.template_id text
column __video_productions.tts_speed numeric(3,2)
column __video_productions.tts_voice text
column __video_productions.updated_at timestamp with time zone default now()
column __video_productions.vertical text not null
column __video_productions.video_type text not null
column __video_templates.allowed_use_cases text[]
column __video_templates.created_at timestamp with time zone default now()
column __video_templates.duration_range int4range
column __video_templates.forbidden_use_cases text[]
column __video_templates.id integer not null default nextval('__video_templates_id_seq'::regclass)
column __video_templates.platform text not null
column __video_templates.structure jsonb
column __video_templates.template_id text not null
column __video_templates.version integer not null default 1
column __video_templates.video_type text not null
column __video_variants.brief_id text not null
column __video_variants.codec text not null
column __video_variants.created_at timestamp with time zone default now()
column __video_variants.duration_secs numeric(8,2)
column __video_variants.execution_log_id integer
column __video_variants.file_size_bytes bigint
column __video_variants.id integer not null default nextval('__video_variants_id_seq'::regclass)
column __video_variants.loudness_lufs numeric(5,2)
column __video_variants.resolution text not null
column __video_variants.s3_path text not null
column __video_variants.variant_name text not null
constraint __video_assets.__video_assets_asset_key_key UNIQUE (asset_key)
constraint __video_assets.__video_assets_pkey PRIMARY KEY (id)
constraint __video_assets.__video_assets_truth_dependency_check CHECK ((truth_dependency = ANY (ARRAY['illustration'::text, 'proof'::text, 'reference'::text])))
constraint __video_assets.__video_assets_visual_type_check CHECK ((visual_type = ANY (ARRAY['schema'::text, 'animation'::text, 'macro'::text, 'motion_text'::text, 'ambiance'::text, 'photo_reelle'::text])))
constraint __video_audio_cache.__video_audio_cache_cache_key_key UNIQUE (cache_key)
constraint __video_audio_cache.__video_audio_cache_pkey PRIMARY KEY (id)
constraint __video_execution_log.__video_execution_log_pkey PRIMARY KEY (id)
constraint __video_productions.__video_productions_brief_id_key UNIQUE (brief_id)
constraint __video_productions.__video_productions_pkey PRIMARY KEY (id)
constraint __video_productions.__video_productions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending_review'::text, 'script_approved'::text, 'storyboard'::text, 'rendering'::text, 'qa'::text, 'qa_failed'::text, 'ready_for_publish'::text, 'published'::text, 'archived'::text])))
constraint __video_productions.__video_productions_video_type_check CHECK ((video_type = ANY (ARRAY['film_socle'::text, 'film_gamme'::text, 'short'::text])))
constraint __video_templates.__video_templates_pkey PRIMARY KEY (id)
constraint __video_templates.__video_templates_platform_check CHECK ((platform = ANY (ARRAY['youtube_long'::text, 'youtube_short'::text, 'instagram_reel'::text, 'tiktok'::text, 'linkedin'::text])))
constraint __video_templates.__video_templates_template_id_key UNIQUE (template_id)
constraint __video_templates.__video_templates_video_type_check CHECK ((video_type = ANY (ARRAY['film_socle'::text, 'film_gamme'::text, 'short'::text])))
constraint __video_variants.__video_variants_execution_log_id_fkey FOREIGN KEY (execution_log_id) REFERENCES __video_execution_log(id)
constraint __video_variants.__video_variants_execution_log_id_variant_name_key UNIQUE (execution_log_id, variant_name)
constraint __video_variants.__video_variants_pkey PRIMARY KEY (id)
index CREATE INDEX idx_vel_brief_id ON public.__video_execution_log USING btree (brief_id)
index CREATE INDEX idx_vel_bullmq_job ON public.__video_execution_log USING btree (bullmq_job_id) WHERE (bullmq_job_id IS NOT NULL)
index CREATE INDEX idx_vel_canary ON public.__video_execution_log USING btree (is_canary, engine_name, created_at DESC) WHERE (is_canary = true)
index CREATE INDEX idx_vel_created_at ON public.__video_execution_log USING btree (created_at DESC)
index CREATE INDEX idx_vel_status ON public.__video_execution_log USING btree (status)
index CREATE INDEX idx_vel_vertical ON public.__video_execution_log USING btree (vertical)
index CREATE INDEX idx_video_assets_validated ON public.__video_assets USING btree (validated) WHERE (validated = true)
index CREATE INDEX idx_video_assets_visual_type ON public.__video_assets USING btree (visual_type)
index CREATE INDEX idx_video_exec_batch ON public.__video_execution_log USING btree (batch_id) WHERE (batch_id IS NOT NULL)
index CREATE INDEX idx_video_prod_created ON public.__video_productions USING btree (created_at)
index CREATE INDEX idx_video_prod_pg_id ON public.__video_productions USING btree (pg_id)
index CREATE INDEX idx_video_prod_status ON public.__video_productions USING btree (status)
index CREATE INDEX idx_video_prod_template ON public.__video_productions USING btree (template_id)
index CREATE INDEX idx_video_prod_vertical ON public.__video_productions USING btree (vertical)
index CREATE INDEX idx_video_productions_parent ON public.__video_productions USING btree (parent_brief_id) WHERE (parent_brief_id IS NOT NULL)
index CREATE INDEX idx_video_variants_brief ON public.__video_variants USING btree (brief_id)
index CREATE UNIQUE INDEX __video_assets_asset_key_key ON public.__video_assets USING btree (asset_key)
index CREATE UNIQUE INDEX __video_assets_pkey ON public.__video_assets USING btree (id)
index CREATE UNIQUE INDEX __video_audio_cache_cache_key_key ON public.__video_audio_cache USING btree (cache_key)
index CREATE UNIQUE INDEX __video_audio_cache_pkey ON public.__video_audio_cache USING btree (id)
index CREATE UNIQUE INDEX __video_execution_log_pkey ON public.__video_execution_log USING btree (id)
index CREATE UNIQUE INDEX __video_productions_brief_id_key ON public.__video_productions USING btree (brief_id)
index CREATE UNIQUE INDEX __video_productions_pkey ON public.__video_productions USING btree (id)
index CREATE UNIQUE INDEX __video_templates_pkey ON public.__video_templates USING btree (id)
index CREATE UNIQUE INDEX __video_templates_template_id_key ON public.__video_templates USING btree (template_id)
index CREATE UNIQUE INDEX __video_variants_execution_log_id_variant_name_key ON public.__video_variants USING btree (execution_log_id, variant_name)
index CREATE UNIQUE INDEX __video_variants_pkey ON public.__video_variants USING btree (id)
sequence __video_assets_id_seq integer start 1 increment 1 max 2147483647 cache 1 cycle f
sequence __video_audio_cache_id_seq integer start 1 increment 1 max 2147483647 cache 1 cycle f
sequence __video_execution_log_id_seq integer start 1 increment 1 max 2147483647 cache 1 cycle f
sequence __video_productions_id_seq integer start 1 increment 1 max 2147483647 cache 1 cycle f
sequence __video_templates_id_seq integer start 1 increment 1 max 2147483647 cache 1 cycle f
sequence __video_variants_id_seq integer start 1 increment 1 max 2147483647 cache 1 cycle f
table __video_assets comment - rls t force f
table __video_audio_cache comment - rls t force f
table __video_execution_log comment - rls t force f
table __video_productions comment - rls t force f
table __video_templates comment - rls t force f
table __video_variants comment - rls t force f
$expected$, E'\n');
BEGIN
  PERFORM set_config('search_path', 'pg_catalog, public', true);
  v_tables := ARRAY['public.__video_execution_log'::regclass,
                    'public.__video_productions'::regclass,
                    'public.__video_variants'::regclass,
                    'public.__video_assets'::regclass,
                    'public.__video_audio_cache'::regclass,
                    'public.__video_templates'::regclass];

  SELECT string_agg(shape.line, E'\n' ORDER BY shape.line COLLATE "C")
    INTO v_actual
    FROM (
      SELECT format('column %s.%s %s%s%s%s',
                    c.relname, a.attname, format_type(a.atttypid, a.atttypmod),
                    CASE WHEN a.attnotnull THEN ' not null' ELSE '' END,
                    coalesce(' default ' || pg_get_expr(d.adbin, d.adrelid), ''),
                    coalesce(' comment ' || col_description(a.attrelid, a.attnum), '')) AS line
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
       WHERE a.attnum > 0
         AND NOT a.attisdropped
         AND a.attrelid = ANY (v_tables::oid[])
      UNION ALL
      SELECT format('constraint %s.%s %s', c.relname, k.conname, pg_get_constraintdef(k.oid))
        FROM pg_constraint k
        JOIN pg_class c ON c.oid = k.conrelid
       WHERE k.conrelid = ANY (v_tables::oid[])
      UNION ALL
      SELECT format('index %s%s', pg_get_indexdef(i.indexrelid),
                    CASE WHEN i.indisvalid AND i.indisready AND i.indislive THEN ''
                         ELSE ' (invalide)' END)
        FROM pg_index i
       WHERE i.indrelid = ANY (v_tables::oid[])
      UNION ALL
      SELECT format('trigger %s', pg_get_triggerdef(g.oid))
        FROM pg_trigger g
       WHERE g.tgrelid = ANY (v_tables::oid[])
         AND NOT g.tgisinternal
      UNION ALL
      SELECT format('rule %s.%s', c.relname, r.rulename)
        FROM pg_rewrite r
        JOIN pg_class c ON c.oid = r.ev_class
       WHERE r.ev_class = ANY (v_tables::oid[])
      UNION ALL
      SELECT format('policy %s.%s hors service_role : %s', c.relname, p.polname,
                    (SELECT string_agg(CASE WHEN o = 0 THEN 'public' ELSE o::regrole::text END,
                                       ',' ORDER BY o)
                       FROM unnest(p.polroles) AS o))
        FROM pg_policy p
        JOIN pg_class c ON c.oid = p.polrelid
       WHERE p.polrelid = ANY (v_tables::oid[])
         AND p.polroles IS DISTINCT FROM ARRAY[to_regrole('service_role')::oid]
      UNION ALL
      SELECT format('sequence %s %s start %s increment %s max %s cache %s cycle %s',
                    s.seqrelid::regclass, format_type(s.seqtypid, NULL),
                    s.seqstart, s.seqincrement, s.seqmax, s.seqcache, s.seqcycle)
        FROM pg_sequence s
       WHERE s.seqrelid IN (SELECT pg_get_serial_sequence(t::text, 'id')::regclass
                              FROM unnest(v_tables) AS t)
      UNION ALL
      SELECT format('table %s comment %s rls %s force %s', c.relname,
                    coalesce(obj_description(c.oid, 'pg_class'), '-'),
                    c.relrowsecurity, c.relforcerowsecurity)
        FROM pg_class c
       WHERE c.oid = ANY (v_tables::oid[])
    ) AS shape;

  PERFORM set_config('search_path', v_search_path, true);

  IF v_actual IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'capture __video_* divergente de la base : application annulée'
      USING DETAIL = format(E'attendu :\n%s\nréel :\n%s', v_expected, v_actual),
            HINT   = 'Re-mesurer le catalogue de la base et refaire la capture ; ne pas modifier la base pour la faire passer.';
  END IF;
END
$postcheck$;
