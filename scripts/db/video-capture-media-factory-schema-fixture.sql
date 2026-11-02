-- =============================================================================
-- Fixture — environnement de 20261031_video_capture_media_factory_schema.sql, sur
-- un PostgreSQL JETABLE.
--
-- Ne reproduit que ce que les migrations du dépôt ne portent pas. Deux passes
-- exclusives :
--   * sans variable, AVANT tout le reste : les rôles API Supabase et leurs
--     privilèges PAR DÉFAUT (ALL accordé à anon/authenticated sur toute table ou
--     séquence créée), service_role en BYPASSRLS ;
--   * avec `-v forme_reelle=1` : les 6 tables `__video_*` telles qu'elles
--     existent en base AVANT toute capture, créées hors du dépôt. Elles sont
--     construites SANS le texte de la capture (séquences explicites, contraintes
--     nommées posées par ALTER TABLE, CHECK écrits `= ANY (ARRAY[…])`) : la
--     post-condition doit accepter la forme du catalogue, pas un texte. Colonnes,
--     ordre, défauts, contraintes, index, commentaires, RLS et politiques relevés
--     en base, en lecture seule, le 2026-10-31 ; les lignes sont inventées.
--
-- Ne cible JAMAIS une base réelle.
-- =============================================================================

-- 2e passe (-v forme_reelle=1) : tables vidéo d'avant la capture.
\if :{?forme_reelle}
CREATE SEQUENCE public.__video_execution_log_id_seq AS integer;
CREATE TABLE public.__video_execution_log (
  id                      integer NOT NULL DEFAULT nextval('public.__video_execution_log_id_seq'::regclass),
  brief_id                text NOT NULL,
  video_type              text NOT NULL,
  vertical                text NOT NULL,
  gamme_alias             text,
  pg_id                   integer,
  status                  character varying NOT NULL DEFAULT 'pending'::character varying,
  bullmq_job_id           character varying,
  trigger_source          character varying NOT NULL,
  trigger_job_id          character varying,
  created_at              timestamp with time zone DEFAULT now(),
  started_at              timestamp with time zone,
  completed_at            timestamp with time zone,
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
ALTER SEQUENCE public.__video_execution_log_id_seq OWNED BY public.__video_execution_log.id;

CREATE SEQUENCE public.__video_productions_id_seq AS integer;
CREATE TABLE public.__video_productions (
  id                   integer NOT NULL DEFAULT nextval('public.__video_productions_id_seq'::regclass),
  brief_id             text NOT NULL,
  video_type           text NOT NULL,
  vertical             text NOT NULL,
  gamme_alias          text,
  pg_id                integer,
  status               text NOT NULL DEFAULT 'draft'::text,
  template_id          text,
  knowledge_contract   jsonb,
  claim_table          jsonb,
  evidence_pack        jsonb,
  disclaimer_plan      jsonb,
  approval_record      jsonb,
  quality_score        integer,
  quality_flags        text[],
  gate_results         jsonb,
  created_by           text NOT NULL DEFAULT 'system'::text,
  created_at           timestamp with time zone DEFAULT now(),
  updated_at           timestamp with time zone DEFAULT now(),
  script_text          text,
  script_generated_at  timestamp with time zone,
  script_model         text,
  narrative_style_pack jsonb,
  derivative_policy    jsonb,
  master_audio_url     text,
  tts_voice            text,
  tts_speed            numeric(3,2),
  parent_brief_id      text,
  derivative_index     integer,
  content_role         text DEFAULT 'master_truth'::text
);
ALTER SEQUENCE public.__video_productions_id_seq OWNED BY public.__video_productions.id;

CREATE SEQUENCE public.__video_variants_id_seq AS integer;
CREATE TABLE public.__video_variants (
  id               integer NOT NULL DEFAULT nextval('public.__video_variants_id_seq'::regclass),
  execution_log_id integer,
  brief_id         text NOT NULL,
  variant_name     text NOT NULL,
  s3_path          text NOT NULL,
  codec            text NOT NULL,
  resolution       text NOT NULL,
  file_size_bytes  bigint,
  duration_secs    numeric(8,2),
  loudness_lufs    numeric(5,2),
  created_at       timestamp with time zone DEFAULT now()
);
ALTER SEQUENCE public.__video_variants_id_seq OWNED BY public.__video_variants.id;

CREATE SEQUENCE public.__video_assets_id_seq AS integer;
CREATE TABLE public.__video_assets (
  id               integer NOT NULL DEFAULT nextval('public.__video_assets_id_seq'::regclass),
  asset_key        text NOT NULL,
  visual_type      text NOT NULL,
  truth_dependency text NOT NULL DEFAULT 'illustration'::text,
  tags             text[],
  file_path        text,
  validated        boolean DEFAULT false,
  validated_by     text,
  created_at       timestamp with time zone DEFAULT now()
);
ALTER SEQUENCE public.__video_assets_id_seq OWNED BY public.__video_assets.id;

CREATE SEQUENCE public.__video_audio_cache_id_seq AS integer;
CREATE TABLE public.__video_audio_cache (
  id            integer NOT NULL DEFAULT nextval('public.__video_audio_cache_id_seq'::regclass),
  cache_key     text NOT NULL,
  url           text NOT NULL,
  duration_secs numeric(6,2),
  voice         text NOT NULL,
  speed         numeric(3,2) NOT NULL,
  char_count    integer NOT NULL,
  created_at    timestamp with time zone DEFAULT now()
);
ALTER SEQUENCE public.__video_audio_cache_id_seq OWNED BY public.__video_audio_cache.id;

CREATE SEQUENCE public.__video_templates_id_seq AS integer;
CREATE TABLE public.__video_templates (
  id                  integer NOT NULL DEFAULT nextval('public.__video_templates_id_seq'::regclass),
  template_id         text NOT NULL,
  version             integer NOT NULL DEFAULT 1,
  video_type          text NOT NULL,
  platform            text NOT NULL,
  allowed_use_cases   text[],
  forbidden_use_cases text[],
  duration_range      int4range,
  structure           jsonb,
  created_at          timestamp with time zone DEFAULT now()
);
ALTER SEQUENCE public.__video_templates_id_seq OWNED BY public.__video_templates.id;

ALTER TABLE public.__video_execution_log
  ADD CONSTRAINT __video_execution_log_pkey PRIMARY KEY (id);
ALTER TABLE public.__video_productions
  ADD CONSTRAINT __video_productions_pkey PRIMARY KEY (id),
  ADD CONSTRAINT __video_productions_brief_id_key UNIQUE (brief_id),
  ADD CONSTRAINT __video_productions_video_type_check
    CHECK (video_type = ANY (ARRAY['film_socle'::text, 'film_gamme'::text, 'short'::text])),
  ADD CONSTRAINT __video_productions_status_check
    CHECK (status = ANY (ARRAY['draft'::text, 'pending_review'::text, 'script_approved'::text,
                               'storyboard'::text, 'rendering'::text, 'qa'::text, 'qa_failed'::text,
                               'ready_for_publish'::text, 'published'::text, 'archived'::text]));
ALTER TABLE public.__video_variants
  ADD CONSTRAINT __video_variants_pkey PRIMARY KEY (id),
  ADD CONSTRAINT __video_variants_execution_log_id_variant_name_key
    UNIQUE (execution_log_id, variant_name),
  ADD CONSTRAINT __video_variants_execution_log_id_fkey
    FOREIGN KEY (execution_log_id) REFERENCES public.__video_execution_log (id);
ALTER TABLE public.__video_assets
  ADD CONSTRAINT __video_assets_pkey PRIMARY KEY (id),
  ADD CONSTRAINT __video_assets_asset_key_key UNIQUE (asset_key),
  ADD CONSTRAINT __video_assets_visual_type_check
    CHECK (visual_type = ANY (ARRAY['schema'::text, 'animation'::text, 'macro'::text,
                                    'motion_text'::text, 'ambiance'::text, 'photo_reelle'::text])),
  ADD CONSTRAINT __video_assets_truth_dependency_check
    CHECK (truth_dependency = ANY (ARRAY['illustration'::text, 'proof'::text, 'reference'::text]));
ALTER TABLE public.__video_audio_cache
  ADD CONSTRAINT __video_audio_cache_pkey PRIMARY KEY (id),
  ADD CONSTRAINT __video_audio_cache_cache_key_key UNIQUE (cache_key);
ALTER TABLE public.__video_templates
  ADD CONSTRAINT __video_templates_pkey PRIMARY KEY (id),
  ADD CONSTRAINT __video_templates_template_id_key UNIQUE (template_id),
  ADD CONSTRAINT __video_templates_video_type_check
    CHECK (video_type = ANY (ARRAY['film_socle'::text, 'film_gamme'::text, 'short'::text])),
  ADD CONSTRAINT __video_templates_platform_check
    CHECK (platform = ANY (ARRAY['youtube_long'::text, 'youtube_short'::text, 'instagram_reel'::text,
                                 'tiktok'::text, 'linkedin'::text]));

CREATE INDEX idx_vel_brief_id ON public.__video_execution_log (brief_id);
CREATE INDEX idx_vel_bullmq_job ON public.__video_execution_log (bullmq_job_id)
  WHERE bullmq_job_id IS NOT NULL;
CREATE INDEX idx_vel_canary ON public.__video_execution_log (is_canary, engine_name, created_at DESC)
  WHERE is_canary = true;
CREATE INDEX idx_vel_created_at ON public.__video_execution_log (created_at DESC);
CREATE INDEX idx_vel_status ON public.__video_execution_log (status);
CREATE INDEX idx_vel_vertical ON public.__video_execution_log (vertical);
CREATE INDEX idx_video_exec_batch ON public.__video_execution_log (batch_id)
  WHERE batch_id IS NOT NULL;
CREATE INDEX idx_video_prod_created ON public.__video_productions (created_at);
CREATE INDEX idx_video_prod_pg_id ON public.__video_productions (pg_id);
CREATE INDEX idx_video_prod_status ON public.__video_productions (status);
CREATE INDEX idx_video_prod_template ON public.__video_productions (template_id);
CREATE INDEX idx_video_prod_vertical ON public.__video_productions (vertical);
CREATE INDEX idx_video_productions_parent ON public.__video_productions (parent_brief_id)
  WHERE parent_brief_id IS NOT NULL;
CREATE INDEX idx_video_variants_brief ON public.__video_variants (brief_id);
CREATE INDEX idx_video_assets_validated ON public.__video_assets (validated)
  WHERE validated = true;
CREATE INDEX idx_video_assets_visual_type ON public.__video_assets (visual_type);

COMMENT ON COLUMN public.__video_execution_log.render_error_code IS
  'P4.0 RenderErrorCode enum value. NULL = success or not yet rendered.';
COMMENT ON COLUMN public.__video_execution_log.engine_resolution IS
  'P4.1.x: requested | fallback_to_stub';
COMMENT ON COLUMN public.__video_execution_log.retryable IS
  'P4.1.x: whether this failed execution can be retried';

-- RLS et politiques service_role telles qu'en base (la capture n'en pose aucune).
ALTER TABLE public.__video_execution_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.__video_productions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.__video_variants      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.__video_assets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.__video_audio_cache   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.__video_templates     ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.__video_execution_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_video_productions ON public.__video_productions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY __video_variants_all_service_role ON public.__video_variants
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_video_assets ON public.__video_assets
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY __video_audio_cache_all_service_role ON public.__video_audio_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_video_templates ON public.__video_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Lignes inventées : la capture ne doit ni les lire ni les réécrire.
INSERT INTO public.__video_execution_log
  (brief_id, video_type, vertical, trigger_source, status, quality_score, engine_resolution)
VALUES
  ('brief-a', 'short', 'freinage', 'manual', 'completed', 82, 'requested'),
  ('brief-a', 'short', 'freinage', 'retry',  'failed',    40, 'fallback_to_stub'),
  ('brief-b', 'film_gamme', 'filtration', 'scheduler', 'pending', 0, NULL);
INSERT INTO public.__video_productions (brief_id, video_type, vertical, status) VALUES
  ('brief-a', 'short', 'freinage', 'qa'),
  ('brief-b', 'film_gamme', 'filtration', 'draft');
INSERT INTO public.__video_variants
  (execution_log_id, brief_id, variant_name, s3_path, codec, resolution) VALUES
  (1, 'brief-a', 'vertical_1080', 'videos/brief-a/vertical_1080.mp4', 'h264', '1080x1920');
INSERT INTO public.__video_audio_cache (cache_key, url, voice, speed, char_count) VALUES
  ('voix-a:1.00:texte', 'audio/voix-a.mp3', 'voix-a', 1.00, 120);
INSERT INTO public.__video_templates (template_id, video_type, platform, duration_range) VALUES
  ('short-v1', 'short', 'youtube_short', int4range(15, 60));
\else
-- 1re passe : rôles API et privilèges par défaut.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon')          THEN CREATE ROLE anon NOLOGIN;          END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role')  THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Défauts Supabase (fixture UNIQUEMENT — jamais dans une migration).
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
\endif
