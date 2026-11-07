-- =============================================================================
-- Fixture du banc scripts/db/test-editorial-filtre-huile-lot.sh
--
-- Schéma des tables et fonctions touchées par le lot éditorial filtre à huile
-- (pg_id 7), relevé en lecture seule le 2026-10-31 (pg_get_functiondef,
-- pg_get_triggerdef, catalogue). Les fonctions sont reprises à l'octet : la
-- migration vérifie leur empreinte md5(prosrc). restore_french_accents est la
-- version d'avant 20261031_accents_protected_segments, que le banc applique.
-- Écarts déclarés : check_breakglass rendue inerte (aucun jeton n'est utilisé,
-- ses deux tables sont omises) ; storage.objects réduit aux colonnes relevées,
-- sans ses triggers ; une règle de scope par table cible, un agent SEO-Content
-- d'identifiant fictif. Les données viennent de
-- build-publication-migration.cjs --fixture-data, chargées avant les triggers
-- (marqueur « @@ triggers ») pour garder l'état relevé intact.
-- =============================================================================

CREATE SCHEMA storage;
CREATE TABLE storage.objects (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  bucket_id text,
  name text,
  owner uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_accessed_at timestamp with time zone DEFAULT now(),
  metadata jsonb,
  path_tokens text[],
  version text,
  owner_id text,
  user_metadata jsonb,
  archived_at timestamp with time zone,
  is_delete_marker boolean DEFAULT false,
  is_versioned boolean DEFAULT false
);

CREATE SEQUENCE public.__seo_r1_image_prompts_rip_id_seq;
CREATE SEQUENCE public.__seo_r3_image_prompts_rip_id_seq;
CREATE SEQUENCE public.agent_scope_table_rules_id_seq;
CREATE SEQUENCE public.agent_write_scopes_id_seq;
CREATE SEQUENCE public.write_scope_violations_id_seq;

-- __gamme_page_cache
CREATE TABLE public.__gamme_page_cache (
  pg_id integer NOT NULL,
  payload jsonb NOT NULL,
  source_hash text NOT NULL,
  built_at timestamp with time zone DEFAULT now() NOT NULL,
  stale boolean DEFAULT false NOT NULL,
  stale_reason text
);
ALTER TABLE public.__gamme_page_cache ADD CONSTRAINT __gamme_page_cache_pkey PRIMARY KEY (pg_id);
CREATE INDEX idx_gpc_stale ON public.__gamme_page_cache USING btree (built_at) WHERE (stale = true);
CREATE INDEX idx_gpc_built_at ON public.__gamme_page_cache USING btree (built_at DESC);
-- __seo_gamme
CREATE TABLE public.__seo_gamme (
  sg_id text NOT NULL,
  sg_title text,
  sg_descrip text,
  sg_keywords text,
  sg_h1 text,
  sg_content text,
  sg_pg_id text NOT NULL,
  sg_descrip_draft text,
  sg_content_draft text,
  sg_draft_source text,
  sg_draft_updated_at timestamp with time zone,
  sg_draft_llm_model text,
  sg_title_draft text,
  sg_updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.__seo_gamme ADD CONSTRAINT __seo_gamme_pkey PRIMARY KEY (sg_id, sg_pg_id);
CREATE INDEX idx___seo_gamme_sg_id ON public.__seo_gamme USING btree (sg_id);
CREATE INDEX idx___seo_gamme_sg_title ON public.__seo_gamme USING btree (sg_title);
CREATE INDEX idx___seo_gamme_sg_descrip ON public.__seo_gamme USING btree (sg_descrip);
CREATE INDEX idx___seo_gamme_sg_keywords ON public.__seo_gamme USING btree (sg_keywords);
CREATE INDEX idx___seo_gamme_sg_h1 ON public.__seo_gamme USING btree (sg_h1);
CREATE INDEX idx_seo_gamme_pg_id ON public.__seo_gamme USING btree (sg_pg_id);
-- __seo_gamme_conseil
CREATE TABLE public.__seo_gamme_conseil (
  sgc_id text NOT NULL,
  sgc_title text,
  sgc_content text,
  sgc_pg_id text NOT NULL,
  sgc_section_type text,
  sgc_order integer,
  sgc_quality_score smallint,
  sgc_sources text,
  sgc_pack_level text,
  sgc_eeat_sources jsonb,
  sgc_safety_notes text[],
  sgc_constructeur_mentions text[],
  sgc_enriched_by text,
  sgc_enriched_at timestamp with time zone
);
ALTER TABLE public.__seo_gamme_conseil ADD CONSTRAINT uq_conseil_pg_section UNIQUE (sgc_pg_id, sgc_section_type);
ALTER TABLE public.__seo_gamme_conseil ADD CONSTRAINT __seo_gamme_conseil_pkey PRIMARY KEY (sgc_id, sgc_pg_id);
ALTER TABLE public.__seo_gamme_conseil ADD CONSTRAINT chk_sgc_section_type CHECK (((sgc_section_type IS NULL) OR (sgc_section_type = ANY (ARRAY['S1'::text, 'S2'::text, 'S2_DIAG'::text, 'S3'::text, 'S4_DEPOSE'::text, 'S4_REPOSE'::text, 'S5'::text, 'S6'::text, 'S7'::text, 'S8'::text, 'S_GARAGE'::text, 'META'::text]))));
CREATE INDEX idx___seo_gamme_conseil_sgc_id ON public.__seo_gamme_conseil USING btree (sgc_id);
CREATE INDEX idx___seo_gamme_conseil_sgc_title ON public.__seo_gamme_conseil USING btree (sgc_title);
CREATE INDEX idx___seo_gamme_conseil_sgc_pg_id ON public.__seo_gamme_conseil USING btree (sgc_pg_id);
CREATE INDEX idx_seo_gamme_conseil_pg_id ON public.__seo_gamme_conseil USING btree (sgc_pg_id, sgc_id);
CREATE INDEX idx_sgc_pack_level ON public.__seo_gamme_conseil USING btree (sgc_pack_level);
-- __seo_r1_gamme_slots
CREATE TABLE public.__seo_r1_gamme_slots (
  r1s_pg_id character varying NOT NULL,
  r1s_h1_override character varying,
  r1s_hero_subtitle text,
  r1s_selector_microcopy text[],
  r1s_micro_seo_block text,
  r1s_compatibilities_intro text,
  r1s_equipementiers_line text,
  r1s_family_cross_sell_intro text,
  r1s_interest_nuggets jsonb,
  r1s_serp_variants jsonb,
  r1s_intent_lock jsonb,
  r1s_safe_table_rows jsonb,
  r1s_arg1_title character varying,
  r1s_arg1_content text,
  r1s_arg1_icon character varying DEFAULT 'check-circle'::character varying,
  r1s_arg2_title character varying,
  r1s_arg2_content text,
  r1s_arg2_icon character varying DEFAULT 'shield-check'::character varying,
  r1s_arg3_title character varying,
  r1s_arg3_content text,
  r1s_arg3_icon character varying DEFAULT 'currency-euro'::character varying,
  r1s_arg4_title character varying,
  r1s_arg4_content text,
  r1s_arg4_icon character varying DEFAULT 'cube'::character varying,
  r1s_faq jsonb,
  r1s_gatekeeper_score integer,
  r1s_gatekeeper_flags text[],
  r1s_gatekeeper_checks jsonb,
  r1s_updated_at timestamp with time zone DEFAULT now(),
  r1s_created_at timestamp with time zone DEFAULT now(),
  r1s_visual_plan jsonb
);
ALTER TABLE public.__seo_r1_gamme_slots ADD CONSTRAINT __seo_r1_gamme_slots_pkey PRIMARY KEY (r1s_pg_id);
ALTER TABLE public.__seo_r1_gamme_slots ADD CONSTRAINT chk_r1s_arg1_content_differs CHECK (((r1s_arg1_content IS NULL) OR (r1s_arg1_title IS NULL) OR (r1s_arg1_content <> (r1s_arg1_title)::text)));
ALTER TABLE public.__seo_r1_gamme_slots ADD CONSTRAINT chk_r1s_arg2_content_differs CHECK (((r1s_arg2_content IS NULL) OR (r1s_arg2_title IS NULL) OR (r1s_arg2_content <> (r1s_arg2_title)::text)));
ALTER TABLE public.__seo_r1_gamme_slots ADD CONSTRAINT chk_r1s_arg3_content_differs CHECK (((r1s_arg3_content IS NULL) OR (r1s_arg3_title IS NULL) OR (r1s_arg3_content <> (r1s_arg3_title)::text)));
ALTER TABLE public.__seo_r1_gamme_slots ADD CONSTRAINT chk_r1s_arg4_content_differs CHECK (((r1s_arg4_content IS NULL) OR (r1s_arg4_title IS NULL) OR (r1s_arg4_content <> (r1s_arg4_title)::text)));
CREATE INDEX idx_r1_gamme_slots_updated ON public.__seo_r1_gamme_slots USING btree (r1s_updated_at DESC);
-- __seo_r1_image_prompts
CREATE TABLE public.__seo_r1_image_prompts (
  rip_id integer DEFAULT nextval('__seo_r1_image_prompts_rip_id_seq'::regclass) NOT NULL,
  rip_pg_id integer NOT NULL,
  rip_pg_alias text NOT NULL,
  rip_gamme_name text NOT NULL,
  rip_slot_id text NOT NULL,
  rip_section_id text NOT NULL,
  rip_topic text NOT NULL,
  rip_aspect_ratio text DEFAULT '16:9'::text NOT NULL,
  rip_min_width integer DEFAULT 1200 NOT NULL,
  rip_prompt_text text NOT NULL,
  rip_alt_text text NOT NULL,
  rip_neg_prompt text,
  rip_caption text,
  rip_budget_cost integer DEFAULT 0 NOT NULL,
  rip_selected boolean DEFAULT false NOT NULL,
  rip_priority_rank integer,
  rip_rag_fields_used text[] DEFAULT '{}'::text[],
  rip_rag_richness_score numeric(3,1) DEFAULT 0,
  rip_status text DEFAULT 'pending'::text NOT NULL,
  rip_image_url text,
  rip_generated_at timestamp with time zone DEFAULT now(),
  rip_updated_at timestamp with time zone DEFAULT now(),
  rip_editorial_brief jsonb,
  rip_stale boolean DEFAULT false
);
ALTER TABLE public.__seo_r1_image_prompts ADD CONSTRAINT __seo_r1_image_prompts_rip_pg_id_rip_slot_id_key UNIQUE (rip_pg_id, rip_slot_id);
ALTER TABLE public.__seo_r1_image_prompts ADD CONSTRAINT __seo_r1_image_prompts_pkey PRIMARY KEY (rip_id);
CREATE INDEX idx_r1_image_prompts_alias ON public.__seo_r1_image_prompts USING btree (rip_pg_alias);
CREATE INDEX idx_r1_image_prompts_status ON public.__seo_r1_image_prompts USING btree (rip_status);
CREATE UNIQUE INDEX uq_r1_selected_per_page_slot ON public.__seo_r1_image_prompts USING btree (rip_pg_id, rip_slot_id) WHERE (rip_selected = true);
-- __seo_r1_related_blocks_cache
CREATE TABLE public.__seo_r1_related_blocks_cache (
  pg_id integer NOT NULL,
  payload jsonb NOT NULL,
  source_hash text NOT NULL,
  built_at timestamp with time zone DEFAULT now() NOT NULL,
  stale boolean DEFAULT false NOT NULL,
  stale_reason text
);
ALTER TABLE public.__seo_r1_related_blocks_cache ADD CONSTRAINT __seo_r1_related_blocks_cache_pkey PRIMARY KEY (pg_id);
CREATE INDEX idx_r1rb_stale ON public.__seo_r1_related_blocks_cache USING btree (built_at) WHERE (stale = true);
CREATE INDEX idx_r1rb_built_at ON public.__seo_r1_related_blocks_cache USING btree (built_at DESC);
-- __seo_r3_image_prompts
CREATE TABLE public.__seo_r3_image_prompts (
  rip_id integer DEFAULT nextval('__seo_r3_image_prompts_rip_id_seq'::regclass) NOT NULL,
  rip_pg_id integer NOT NULL,
  rip_pg_alias text NOT NULL,
  rip_gamme_name text NOT NULL,
  rip_slot_id text NOT NULL,
  rip_section_id text NOT NULL,
  rip_topic text NOT NULL,
  rip_aspect_ratio text NOT NULL,
  rip_min_width integer NOT NULL,
  rip_prompt_text text NOT NULL,
  rip_alt_text text NOT NULL,
  rip_neg_prompt text,
  rip_caption text,
  rip_budget_cost integer DEFAULT 1 NOT NULL,
  rip_selected boolean DEFAULT false NOT NULL,
  rip_priority_rank integer,
  rip_rag_fields_used text[],
  rip_rag_richness_score integer,
  rip_generated_by text DEFAULT 'r3-image-prompt-service'::text NOT NULL,
  rip_generated_at timestamp with time zone DEFAULT now() NOT NULL,
  rip_status text DEFAULT 'pending'::text NOT NULL,
  rip_kp_id integer,
  rip_image_url text
);
ALTER TABLE public.__seo_r3_image_prompts ADD CONSTRAINT uq_rip_gamme_slot UNIQUE (rip_pg_id, rip_slot_id);
ALTER TABLE public.__seo_r3_image_prompts ADD CONSTRAINT __seo_r3_image_prompts_pkey PRIMARY KEY (rip_id);
CREATE INDEX idx_rip_pg_alias ON public.__seo_r3_image_prompts USING btree (rip_pg_alias);
CREATE INDEX idx_rip_status ON public.__seo_r3_image_prompts USING btree (rip_status);
CREATE INDEX idx_rip_selected ON public.__seo_r3_image_prompts USING btree (rip_selected) WHERE (rip_selected = true);
CREATE INDEX idx_rip_slot_id ON public.__seo_r3_image_prompts USING btree (rip_slot_id);
-- agent_scope_table_rules
CREATE TABLE public.agent_scope_table_rules (
  id integer DEFAULT nextval('agent_scope_table_rules_id_seq'::regclass) NOT NULL,
  scope text NOT NULL,
  table_pattern text NOT NULL,
  allowed_operations text[] DEFAULT '{insert,update}'::text[] NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.agent_scope_table_rules ADD CONSTRAINT agent_scope_table_rules_scope_table_pattern_key UNIQUE (scope, table_pattern);
ALTER TABLE public.agent_scope_table_rules ADD CONSTRAINT agent_scope_table_rules_pkey PRIMARY KEY (id);
CREATE INDEX idx_astr_scope ON public.agent_scope_table_rules USING btree (scope);
-- agent_write_scopes
CREATE TABLE public.agent_write_scopes (
  id integer DEFAULT nextval('agent_write_scopes_id_seq'::regclass) NOT NULL,
  agent_id uuid NOT NULL,
  agent_name text NOT NULL,
  write_scope text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.agent_write_scopes ADD CONSTRAINT agent_write_scopes_agent_id_key UNIQUE (agent_id);
ALTER TABLE public.agent_write_scopes ADD CONSTRAINT agent_write_scopes_pkey PRIMARY KEY (id);
ALTER TABLE public.agent_write_scopes ADD CONSTRAINT agent_write_scopes_write_scope_check CHECK ((write_scope = ANY (ARRAY['seo_content_tables'::text, 'data_quality_tables'::text, 'qa_tables'::text, 'blog_tables'::text, 'perf_tables'::text, 'weaviate_index_only'::text, 'issue_creation_only'::text, 'issue_and_documents'::text, 'none'::text])));
-- pieces_gamme
CREATE TABLE public.pieces_gamme (
  pg_id integer NOT NULL,
  pg_parent text,
  pg_ppa_id text,
  pg_alias text,
  pg_name text,
  pg_name_url text,
  pg_name_meta text,
  pg_pic text,
  pg_img text,
  pg_wall text,
  pg_relfollow text,
  pg_sitemap text,
  pg_cross text,
  pg_level text,
  pg_display text,
  pg_top text,
  pg_g_level character varying(5),
  pg_parent_gamme_id integer,
  pg_status character varying(20) DEFAULT 'ACTIVE'::character varying,
  gamme_universelle boolean DEFAULT false
);
ALTER TABLE public.pieces_gamme ADD CONSTRAINT pieces_gamme_pkey PRIMARY KEY (pg_id);
ALTER TABLE public.pieces_gamme ADD CONSTRAINT pieces_gamme_pg_status_check CHECK (((pg_status)::text = ANY (ARRAY[('ACTIVE'::character varying)::text, ('HIDDEN'::character varying)::text, ('DEPRECATED'::character varying)::text, ('DELETED'::character varying)::text])));
CREATE INDEX idx_pieces_gamme_pg_parent ON public.pieces_gamme USING btree (pg_parent);
CREATE INDEX idx_pieces_gamme_pg_ppa_id ON public.pieces_gamme USING btree (pg_ppa_id);
CREATE INDEX idx_pieces_gamme_pg_alias ON public.pieces_gamme USING btree (pg_alias);
CREATE INDEX idx_pieces_gamme_pg_name ON public.pieces_gamme USING btree (pg_name);
CREATE INDEX idx_pieces_gamme_pg_name_url ON public.pieces_gamme USING btree (pg_name_url);
CREATE INDEX idx_pieces_gamme_pg_name_meta ON public.pieces_gamme USING btree (pg_name_meta);
CREATE INDEX idx_pieces_gamme_pg_pic ON public.pieces_gamme USING btree (pg_pic);
CREATE INDEX idx_pieces_gamme_pg_img ON public.pieces_gamme USING btree (pg_img);
CREATE INDEX idx_pieces_gamme_pg_wall ON public.pieces_gamme USING btree (pg_wall);
CREATE INDEX idx_pieces_gamme_pg_relfollow ON public.pieces_gamme USING btree (pg_relfollow);
CREATE INDEX idx_pieces_gamme_pg_sitemap ON public.pieces_gamme USING btree (pg_sitemap);
CREATE INDEX idx_pieces_gamme_pg_cross ON public.pieces_gamme USING btree (pg_cross);
CREATE INDEX idx_pieces_gamme_pg_level ON public.pieces_gamme USING btree (pg_level);
CREATE INDEX idx_pieces_gamme_pg_display ON public.pieces_gamme USING btree (pg_display);
CREATE INDEX idx_pieces_gamme_pg_top ON public.pieces_gamme USING btree (pg_top);
CREATE INDEX idx_gamme_display_name ON public.pieces_gamme USING btree (pg_display, pg_name) WHERE (pg_display = '1'::text);
CREATE INDEX idx_pieces_gamme_display_level ON public.pieces_gamme USING btree (pg_id) WHERE ((pg_display = '1'::text) AND (pg_level = ANY (ARRAY['1'::text, '2'::text])));
CREATE INDEX idx_pg_g_level ON public.pieces_gamme USING btree (pg_g_level);
CREATE INDEX idx_pg_display_level ON public.pieces_gamme USING btree (pg_display, pg_level);
CREATE INDEX idx_pg_parent ON public.pieces_gamme USING btree (pg_parent_gamme_id);
CREATE INDEX idx_pieces_gamme_pg_status ON public.pieces_gamme USING btree (pg_status);
CREATE UNIQUE INDEX uq_pieces_gamme_pg_alias ON public.pieces_gamme USING btree (pg_alias) WHERE ((pg_alias IS NOT NULL) AND (pg_alias <> ''::text));
CREATE INDEX idx_pieces_gamme_parent_main ON public.pieces_gamme USING btree (pg_parent_gamme_id) WHERE (pg_parent_gamme_id IS NOT NULL);
-- write_scope_violations
CREATE TABLE public.write_scope_violations (
  id bigint DEFAULT nextval('write_scope_violations_id_seq'::regclass) NOT NULL,
  attempted_at timestamp with time zone DEFAULT now(),
  agent_id uuid,
  agent_name text,
  write_scope text,
  target_table text NOT NULL,
  operation text NOT NULL,
  blocked boolean DEFAULT true,
  context jsonb
);
ALTER TABLE public.write_scope_violations ADD CONSTRAINT write_scope_violations_pkey PRIMARY KEY (id);
CREATE INDEX idx_wsv_attempted_at ON public.write_scope_violations USING btree (attempted_at DESC);
CREATE INDEX idx_wsv_agent_id ON public.write_scope_violations USING btree (agent_id) WHERE (blocked = true);

ALTER TABLE public.__seo_gamme ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.__seo_gamme_conseil ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.__seo_r1_gamme_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.__seo_r1_image_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.__seo_r3_image_prompts ENABLE ROW LEVEL SECURITY;

-- check_breakglass : inerte dans le banc.
CREATE OR REPLACE FUNCTION public.check_breakglass(p_token text, p_table text)
 RETURNS boolean
 LANGUAGE sql
AS $function$ SELECT false $function$;

CREATE OR REPLACE FUNCTION public.restore_french_accents(input_text text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  result text := input_text;
  -- Dictionnaire : (pattern_sans_accent, forme_accentuee)
  -- Ordre important : patterns longs d'abord pour éviter les collisions
  patterns text[][] := ARRAY[
    -- Locutions à + nom (fréquent dans "filtre à X")
    ['\ya air\y', 'à air'],
    ['\ya huile\y', 'à huile'],
    ['\ya carburant\y', 'à carburant'],
    ['\ya pollen\y', 'à pollen'],
    ['\ya gasoil\y', 'à gasoil'],
    ['\ya remplacer\y', 'à remplacer'],
    ['\ya controler\y', 'à contrôler'],
    ['\ya verifier\y', 'à vérifier'],
    ['\ya deposer\y', 'à déposer'],
    ['\ya eviter\y', 'à éviter'],
    ['\ya travers\y', 'à travers'],
    ['\ya jour\y', 'à jour'],
    ['\ya temps\y', 'à temps'],
    ['\yl acceleration\y', 'l''accélération'],
    ['\yl admission\y', 'l''admission'],
    ['\yl echappement\y', 'l''échappement'],
    -- Verbes au participe passé (fréquents)
    ['\yaspire\y', 'aspiré'],
    ['\yaspirer\y', 'aspirer'],
    ['\ysitue\y', 'situé'],
    ['\ysituee\y', 'située'],
    ['\yprotege\y', 'protège'],
    ['\yprotegee\y', 'protégée'],
    ['\yproteger\y', 'protéger'],
    ['\yverifie\y', 'vérifié'],
    ['\yverifier\y', 'vérifier'],
    ['\ycontrole\y', 'contrôle'],
    ['\ycontroler\y', 'contrôler'],
    ['\ydemonte\y', 'démonté'],
    ['\ydemontage\y', 'démontage'],
    ['\ydemonter\y', 'démonter'],
    ['\ymonte\y', 'monté'],
    ['\ymontee\y', 'montée'],
    ['\yinstalle\y', 'installé'],
    ['\yinstaller\y', 'installer'],
    ['\yrecommande\y', 'recommandé'],
    ['\yrecommandee\y', 'recommandée'],
    ['\ypose\y', 'posé'],
    ['\yrepose\y', 'reposé'],
    ['\ydepose\y', 'déposé'],
    ['\ydepend\y', 'dépend'],
    ['\yetat\y', 'état'],
    ['\yaccede\y', 'accède'],
    ['\yacces\y', 'accès'],
    ['\yprocede\y', 'procédé'],
    ['\yprecede\y', 'précédé'],
    ['\ypreconise\y', 'préconisé'],
    ['\ypreconisation\y', 'préconisation'],
    ['\ypreconisations\y', 'préconisations'],
    ['\yprecis\y', 'précis'],
    ['\yprecision\y', 'précision'],
    ['\yendommage\y', 'endommagé'],
    ['\yendommager\y', 'endommager'],
    ['\yrepandu\y', 'répandu'],
    ['\yrepandue\y', 'répandue'],
    ['\ydifference\y', 'différence'],
    ['\ydifferent\y', 'différent'],
    ['\ydifferente\y', 'différente'],
    ['\yameliore\y', 'amélioré'],
    ['\yameliorer\y', 'améliorer'],
    ['\yamelioration\y', 'amélioration'],
    ['\ydegrade\y', 'dégradé'],
    ['\ydegrader\y', 'dégrader'],
    ['\ydeteriore\y', 'détérioré'],
    ['\ydeteriorer\y', 'détériorer'],
    ['\yexperience\y', 'expérience'],
    ['\yreparation\y', 'réparation'],
    ['\yreparer\y', 'réparer'],
    ['\ypanne\y', 'panne'],
    ['\yconsommation\y', 'consommation'],
    ['\yacceleration\y', 'accélération'],
    ['\yechappement\y', 'échappement'],
    ['\yadmission\y', 'admission'],
    ['\yprobleme\y', 'problème'],
    ['\yproblemes\y', 'problèmes'],
    ['\ysysteme\y', 'système'],
    ['\ysystemes\y', 'systèmes'],
    ['\yprocedure\y', 'procédure'],
    ['\ymodele\y', 'modèle'],
    ['\ymodeles\y', 'modèles'],
    ['\yreference\y', 'référence'],
    ['\yreferences\y', 'références'],
    ['\yveuillez\y', 'veuillez'],
    ['\ynecessaire\y', 'nécessaire'],
    ['\ynecessite\y', 'nécessite'],
    ['\ynecessiter\y', 'nécessiter'],
    ['\yplusieurs\y', 'plusieurs'],
    ['\ypoussiere\y', 'poussière'],
    ['\ypoussieres\y', 'poussières'],
    ['\ymatiere\y', 'matière'],
    ['\ymatieres\y', 'matières'],
    ['\ymaniere\y', 'manière'],
    ['\ymanieres\y', 'manières'],
    ['\ypremiere\y', 'première'],
    ['\ypremier\y', 'premier'],
    ['\yderniere\y', 'dernière'],
    ['\ydernier\y', 'dernier'],
    ['\ycarriere\y', 'carrière'],
    ['\yarriere\y', 'arrière'],
    ['\yavant\y', 'avant'],
    ['\ymoteur\y', 'moteur'],
    ['\yfrein\y', 'frein'],
    ['\ycylindre\y', 'cylindre'],
    ['\ycylindres\y', 'cylindres'],
    ['\ysoupape\y', 'soupape'],
    ['\ysoupapes\y', 'soupapes'],
    ['\ysegment\y', 'segment'],
    ['\ysegments\y', 'segments'],
    ['\ycollecteur\y', 'collecteur'],
    ['\yallege\y', 'allégé'],
    ['\yserie\y', 'série'],
    ['\yseries\y', 'séries'],
    ['\yusure\y', 'usure'],
    ['\yconstructeur\y', 'constructeur'],
    ['\yconstructeurs\y', 'constructeurs'],
    ['\yqualite\y', 'qualité'],
    ['\yqualites\y', 'qualités'],
    ['\ydurabilite\y', 'durabilité'],
    ['\ycomplete\y', 'complète'],
    ['\ycomplet\y', 'complet'],
    ['\ybeaucoup\y', 'beaucoup'],
    -- Préfixes avec é
    ['\yetanche\y', 'étanche'],
    ['\yetancheite\y', 'étanchéité'],
    ['\yequipe\y', 'équipé'],
    ['\yequipement\y', 'équipement'],
    ['\yequipements\y', 'équipements'],
    ['\ymetal\y', 'métal'],
    ['\ymetallique\y', 'métallique'],
    ['\yenerge\y', 'énergé'],
    ['\yenergie\y', 'énergie'],
    ['\yeffectue\y', 'effectué'],
    ['\yeffectuer\y', 'effectuer'],
    -- à (préposition isolée) — très conservateur
    ['\ya ete\y', 'a été'],
    ['\ya eu\y', 'a eu'],
    -- Mots très fréquents
    ['\yelement\y', 'élément'],
    ['\yelements\y', 'éléments'],
    ['\yelementaire\y', 'élémentaire'],
    ['\ydetecte\y', 'détecté'],
    ['\ydetecter\y', 'détecter'],
    ['\ydetection\y', 'détection']
  ];
  i integer;
BEGIN
  FOR i IN 1..array_length(patterns, 1) LOOP
    result := regexp_replace(result, patterns[i][1], patterns[i][2], 'g');
  END LOOP;
  RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.resolve_agent_write_scope()
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_agent_id UUID;
  v_scope TEXT;
BEGIN
  BEGIN
    v_agent_id := (current_setting('request.headers', true)::json->>'x-agent-id')::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  IF v_agent_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT write_scope INTO v_scope
  FROM agent_write_scopes
  WHERE agent_id = v_agent_id;

  IF v_scope IS NULL THEN
    RETURN 'DENY_ALL';
  END IF;

  RETURN v_scope;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_agent_write_allowed(p_table text, p_operation text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_scope TEXT;
  v_agent_id UUID;
  v_agent_name TEXT;
  v_allowed BOOLEAN := FALSE;
  v_breakglass_token TEXT;
  v_op_lower TEXT;
BEGIN
  v_scope := resolve_agent_write_scope();

  IF v_scope IS NULL THEN
    RETURN TRUE;
  END IF;

  BEGIN
    v_agent_id := (current_setting('request.headers', true)::json->>'x-agent-id')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_agent_id := NULL;
  END;

  SELECT agent_name INTO v_agent_name
  FROM agent_write_scopes WHERE agent_id = v_agent_id;

  BEGIN
    v_breakglass_token := current_setting('request.headers', true)::json->>'x-breakglass-token';
    IF v_breakglass_token IS NOT NULL THEN
      IF check_breakglass(v_breakglass_token, p_table) THEN
        INSERT INTO write_scope_violations
          (agent_id, agent_name, write_scope, target_table, operation, blocked, context)
        VALUES
          (v_agent_id, v_agent_name, v_scope, p_table, p_operation, FALSE,
           jsonb_build_object('reason', 'break_glass_override', 'timestamp', NOW()));
        RETURN TRUE;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  IF v_scope = 'DENY_ALL' THEN
    v_allowed := FALSE;
  ELSE
    v_op_lower := lower(p_operation);
    SELECT EXISTS (
      SELECT 1 FROM agent_scope_table_rules
      WHERE scope = v_scope
        AND v_op_lower = ANY(allowed_operations)
        AND (
          p_table = table_pattern
          OR (position('*' in table_pattern) > 0
              AND p_table LIKE replace(table_pattern, '*', '%'))
        )
    ) INTO v_allowed;
  END IF;

  IF NOT v_allowed THEN
    INSERT INTO write_scope_violations
      (agent_id, agent_name, write_scope, target_table, operation, blocked, context)
    VALUES
      (v_agent_id, v_agent_name, v_scope, p_table, p_operation, TRUE,
       jsonb_build_object('session_role', current_user, 'timestamp', NOW()));
  END IF;

  RETURN v_allowed;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_agent_write_scope()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT check_agent_write_allowed(TG_TABLE_NAME, TG_OP) THEN
    RAISE EXCEPTION 'write_scope_violation: agent not authorized to % on %',
      TG_OP, TG_TABLE_NAME
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_auto_restore_accents_r1_meta()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.sg_content := restore_french_accents(NEW.sg_content);
  NEW.sg_title := restore_french_accents(NEW.sg_title);
  NEW.sg_descrip := restore_french_accents(NEW.sg_descrip);
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_auto_restore_accents_r1_slots()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.r1s_micro_seo_block := restore_french_accents(NEW.r1s_micro_seo_block);
  NEW.r1s_hero_subtitle := restore_french_accents(NEW.r1s_hero_subtitle);
  NEW.r1s_h1_override := restore_french_accents(NEW.r1s_h1_override);
  NEW.r1s_compatibilities_intro := restore_french_accents(NEW.r1s_compatibilities_intro);
  NEW.r1s_equipementiers_line := restore_french_accents(NEW.r1s_equipementiers_line);
  NEW.r1s_family_cross_sell_intro := restore_french_accents(NEW.r1s_family_cross_sell_intro);
  -- Args content (pas les titles — ils sont stables)
  NEW.r1s_arg1_content := restore_french_accents(NEW.r1s_arg1_content);
  NEW.r1s_arg2_content := restore_french_accents(NEW.r1s_arg2_content);
  NEW.r1s_arg3_content := restore_french_accents(NEW.r1s_arg3_content);
  NEW.r1s_arg4_content := restore_french_accents(NEW.r1s_arg4_content);
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_auto_restore_accents_r3()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.sgc_content := restore_french_accents(NEW.sgc_content);
  NEW.sgc_title := restore_french_accents(NEW.sgc_title);
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.invalidate_r1_caches(p_pg_id integer, p_reason text, p_targets text DEFAULT 'both'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_pg_id IS NULL OR p_pg_id <= 0 THEN
    RETURN;
  END IF;
  IF p_targets IN ('gpc', 'both') THEN
    UPDATE public.__gamme_page_cache
    SET stale = TRUE, stale_reason = p_reason
    WHERE pg_id = p_pg_id AND stale = FALSE;
  END IF;
  IF p_targets IN ('r1rb', 'both') THEN
    UPDATE public.__seo_r1_related_blocks_cache
    SET stale = TRUE, stale_reason = p_reason
    WHERE pg_id = p_pg_id AND stale = FALSE;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_invalidate_r1_from_image_prompts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM public.invalidate_r1_caches(OLD.rip_pg_id, 'image_prompts:DELETE', 'gpc');
  ELSE
    PERFORM public.invalidate_r1_caches(NEW.rip_pg_id, 'image_prompts:'||TG_OP, 'gpc');
    IF (TG_OP = 'UPDATE' AND OLD.rip_pg_id IS DISTINCT FROM NEW.rip_pg_id) THEN
      PERFORM public.invalidate_r1_caches(OLD.rip_pg_id, 'image_prompts:UPDATE-pg_id-changed', 'gpc');
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_invalidate_r1_from_seo_gamme()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pg_id_old INTEGER;
  v_pg_id_new INTEGER;
BEGIN
  v_pg_id_new := NULLIF(NULLIF(NEW.sg_pg_id, ''), '0')::INTEGER;
  IF (TG_OP = 'DELETE') THEN
    v_pg_id_old := NULLIF(NULLIF(OLD.sg_pg_id, ''), '0')::INTEGER;
    PERFORM public.invalidate_r1_caches(v_pg_id_old, 'seo_gamme:DELETE', 'both');
  ELSE
    PERFORM public.invalidate_r1_caches(v_pg_id_new, 'seo_gamme:'||TG_OP, 'both');
    -- If sg_pg_id changed (rare), also invalidate the OLD pg_id
    IF (TG_OP = 'UPDATE') THEN
      v_pg_id_old := NULLIF(NULLIF(OLD.sg_pg_id, ''), '0')::INTEGER;
      IF v_pg_id_old IS DISTINCT FROM v_pg_id_new THEN
        PERFORM public.invalidate_r1_caches(v_pg_id_old, 'seo_gamme:UPDATE-pg_id-changed', 'both');
      END IF;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_warn_orphan_pg_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  pgid_str text;
  exists_in_pg boolean;
  rec_json jsonb;
BEGIN
  rec_json := to_jsonb(NEW);
  pgid_str := COALESCE(
    rec_json->>'r1s_pg_id',
    rec_json->>'sgpg_pg_id',
    rec_json->>'sgc_pg_id',
    rec_json->>'sg_pg_id'
  );
  IF pgid_str IS NULL THEN RETURN NEW; END IF;
  SELECT EXISTS (SELECT 1 FROM pieces_gamme pg WHERE pg.pg_id::text = pgid_str) INTO exists_in_pg;
  IF NOT exists_in_pg THEN
    RAISE WARNING 'orphan_pg_id: table=% pg_id=% has no matching pieces_gamme row', TG_TABLE_NAME, pgid_str;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_r1_gamme_slots_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.r1s_updated_at = NOW();
  RETURN NEW;
END;
$function$
;

INSERT INTO agent_write_scopes (agent_id, agent_name, write_scope)
VALUES ('00000000-0000-4000-8000-00000000c0de', 'SEO-Content', 'seo_content_tables'),
       ('00000000-0000-4000-8000-0000000000aa', 'QA-Banc', 'qa_tables');
INSERT INTO agent_scope_table_rules (scope, table_pattern, allowed_operations) VALUES
  ('seo_content_tables', '__seo_gamme', '{insert,update}'),
  ('seo_content_tables', '__seo_gamme_conseil', '{insert,update}'),
  ('seo_content_tables', '__seo_r1_gamme_slots', '{insert,update}'),
  ('seo_content_tables', '__seo_r1_image_prompts', '{insert,update}'),
  ('seo_content_tables', '__seo_r3_image_prompts', '{insert,update}');

-- @@ triggers
CREATE TRIGGER trg_auto_restore_accents_r1_meta BEFORE INSERT OR UPDATE ON public.__seo_gamme FOR EACH ROW EXECUTE FUNCTION fn_auto_restore_accents_r1_meta();
CREATE TRIGGER trg_gpc_invalidate_seo_gamme AFTER INSERT OR DELETE OR UPDATE ON public.__seo_gamme FOR EACH ROW EXECUTE FUNCTION trg_invalidate_r1_from_seo_gamme();
CREATE TRIGGER trg_warn_orphan_r1_meta BEFORE INSERT ON public.__seo_gamme FOR EACH ROW EXECUTE FUNCTION fn_warn_orphan_pg_id();
CREATE TRIGGER trg_write_scope___seo_gamme BEFORE INSERT OR UPDATE ON public.__seo_gamme FOR EACH ROW EXECUTE FUNCTION enforce_agent_write_scope();
CREATE TRIGGER trg_auto_restore_accents_r3 BEFORE INSERT OR UPDATE ON public.__seo_gamme_conseil FOR EACH ROW EXECUTE FUNCTION fn_auto_restore_accents_r3();
CREATE TRIGGER trg_warn_orphan_r3_conseils BEFORE INSERT ON public.__seo_gamme_conseil FOR EACH ROW EXECUTE FUNCTION fn_warn_orphan_pg_id();
CREATE TRIGGER trg_write_scope___seo_gamme_conseil BEFORE INSERT OR UPDATE ON public.__seo_gamme_conseil FOR EACH ROW EXECUTE FUNCTION enforce_agent_write_scope();
CREATE TRIGGER trg_auto_restore_accents_r1_slots BEFORE INSERT OR UPDATE ON public.__seo_r1_gamme_slots FOR EACH ROW EXECUTE FUNCTION fn_auto_restore_accents_r1_slots();
CREATE TRIGGER trg_r1_slots_updated BEFORE UPDATE ON public.__seo_r1_gamme_slots FOR EACH ROW EXECUTE FUNCTION trg_r1_gamme_slots_updated_at();
CREATE TRIGGER trg_warn_orphan_r1_slots BEFORE INSERT ON public.__seo_r1_gamme_slots FOR EACH ROW EXECUTE FUNCTION fn_warn_orphan_pg_id();
CREATE TRIGGER trg_write_scope___seo_r1_gamme_slots BEFORE INSERT OR UPDATE ON public.__seo_r1_gamme_slots FOR EACH ROW EXECUTE FUNCTION enforce_agent_write_scope();
CREATE TRIGGER trg_gpc_invalidate_image_prompts AFTER INSERT OR DELETE OR UPDATE ON public.__seo_r1_image_prompts FOR EACH ROW EXECUTE FUNCTION trg_invalidate_r1_from_image_prompts();
CREATE TRIGGER trg_write_scope___seo_r1_image_prompts BEFORE INSERT OR UPDATE ON public.__seo_r1_image_prompts FOR EACH ROW EXECUTE FUNCTION enforce_agent_write_scope();
CREATE TRIGGER trg_write_scope___seo_r3_image_prompts BEFORE INSERT OR UPDATE ON public.__seo_r3_image_prompts FOR EACH ROW EXECUTE FUNCTION enforce_agent_write_scope();
