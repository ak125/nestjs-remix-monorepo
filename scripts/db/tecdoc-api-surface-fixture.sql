-- =============================================================================
-- Fixture — reproduction du MODÈLE DE SÉCURITÉ TecDoc tel qu'il est en PROD
-- avant la migration 20260907_tecdoc_api_surface_lockdown.sql
--
-- Ce n'est PAS une reproduction des données (113 Go) : c'est une reproduction
-- fidèle de ce qui décide des autorisations — schémas, rôles, propriétaires,
-- grants, sémantique DEFINER/INVOKER des vues, et le franchissement
-- public → tecdoc_*. Les définitions des 3 vues et des 2 fonctions sont
-- recopiées verbatim depuis la base live (pg_get_viewdef / pg_get_functiondef,
-- 2026-09-07).
--
-- S'applique sur un PostgreSQL jetable. Ne cible JAMAIS la base de production.
-- =============================================================================

-- --- Rôles API (mêmes noms qu'en Supabase) -----------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon')          THEN CREATE ROLE anon NOLOGIN;          END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role')  THEN CREATE ROLE service_role NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='dev_readonly')  THEN CREATE ROLE dev_readonly NOLOGIN; END IF;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, dev_readonly;

-- --- Schémas tecdoc : AUCUN USAGE pour les rôles API (l'isolation nominale) ---
CREATE SCHEMA IF NOT EXISTS tecdoc_raw;
CREATE SCHEMA IF NOT EXISTS tecdoc_map;
REVOKE ALL ON SCHEMA tecdoc_raw, tecdoc_map FROM PUBLIC, anon, authenticated, service_role, dev_readonly;

-- --- Tables tecdoc_* ----------------------------------------------------------
CREATE TABLE tecdoc_raw.t400        (col_2 text, col_6 text);
CREATE TABLE tecdoc_map.source_linkages   (source_dlnr integer, source_artnr text);
CREATE TABLE tecdoc_map.article_registry  (piece_id bigint, source_artnr text, source_dlnr integer);
CREATE TABLE tecdoc_map.losch_log (
  id bigserial PRIMARY KEY, source_artnr text, source_dlnr integer, source_table text,
  losch_flag text, action text, reason text, piece_id bigint, batch_id text,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE tecdoc_map.type_id_remap (
  old_id integer PRIMARY KEY, new_id integer UNIQUE, type_name text,
  marque_id integer, modele_name text, remapped_at timestamptz DEFAULT now()
);

-- --- Tables public consommées par les vues ------------------------------------
CREATE TABLE public.auto_marque (marque_id integer PRIMARY KEY, marque_alias text);
CREATE TABLE public.auto_modele (modele_id integer PRIMARY KEY, modele_marque_id smallint, modele_alias varchar(40));
CREATE TABLE public.auto_type   (type_id text PRIMARY KEY, type_alias text, type_name text, type_modele_id text, type_id_i integer, type_display text);
CREATE TABLE public.pieces_marque (pm_id integer PRIMARY KEY, pm_name text, pm_display text);
CREATE TABLE public.pieces_gamme  (pg_id integer PRIMARY KEY, pg_alias text);
CREATE TABLE public.pieces (piece_id bigint PRIMARY KEY, piece_ref text, piece_pm_id integer, piece_pg_id integer, piece_year integer, piece_display boolean);
CREATE TABLE public.pieces_relation_type (rtp_piece_id bigint, rtp_type_id integer);
CREATE TABLE public.__tecdoc_supplier_mapping (dlnr integer, sup_pm_id integer);

-- --- Données minimales : un remap résolvable (le cas 301 nominal) -------------
INSERT INTO public.auto_marque VALUES (7, 'alfa-romeo');
INSERT INTO public.auto_modele VALUES (7042, 7::smallint, 'mito');
INSERT INTO public.auto_type   VALUES ('60050', 'mito-1-3-jtdm', 'MITO 1.3 JTDM', '7042', 60050, '1');
INSERT INTO tecdoc_map.type_id_remap (old_id, new_id) VALUES (144071, 60050);
INSERT INTO tecdoc_map.losch_log (source_artnr, source_dlnr, action) VALUES ('SEED', 1, 'seed');
INSERT INTO public.pieces_marque VALUES (4820, 'VALEO', '1');
INSERT INTO public.__tecdoc_supplier_mapping VALUES (21, 4820);

-- --- v_tecdoc_activation_candidates : déjà INVOKER en prod, reproduite telle quelle
CREATE VIEW public.v_tecdoc_activation_candidates AS
  SELECT p.piece_id FROM public.pieces p WHERE p.piece_display = true;
ALTER VIEW public.v_tecdoc_activation_candidates SET (security_invoker = true);

-- --- Les 3 vues DEFINER (reloptions NULL = sémantique propriétaire) -----------
CREATE VIEW public.__tecdoc_losch_log AS
  SELECT id, source_artnr, source_dlnr, source_table, losch_flag, action, reason,
         piece_id, batch_id, created_at
  FROM tecdoc_map.losch_log;

CREATE VIEW public.v_tecdoc_dlnr_reconciliation AS
  SELECT sm.dlnr, pm.pm_name, pm.pm_display,
    (EXISTS (SELECT 1 FROM tecdoc_raw.t400 WHERE t400.col_2 = sm.dlnr::text LIMIT 1)) AS has_t400,
    (EXISTS (SELECT 1 FROM tecdoc_map.source_linkages WHERE source_linkages.source_dlnr = sm.dlnr LIMIT 1)) AS has_sl,
    (SELECT count(*) FROM public.pieces WHERE pieces.piece_pm_id = pm.pm_id AND pieces.piece_year = 2025) AS pieces_2025
  FROM public.__tecdoc_supplier_mapping sm
  JOIN public.pieces_marque pm ON pm.pm_id = sm.sup_pm_id
  WHERE sm.dlnr IS NOT NULL;

CREATE VIEW public.v_tecdoc_unlinked_pieces_reason AS
  SELECT p.piece_id, p.piece_ref, pm.pm_name, pg.pg_alias,
    CASE
      WHEN NOT (EXISTS (SELECT 1 FROM tecdoc_map.article_registry ar WHERE ar.piece_id = p.piece_id)) THEN 'no_registry'::text
      WHEN NOT (EXISTS (SELECT 1 FROM tecdoc_map.source_linkages sl
                        JOIN tecdoc_map.article_registry ar ON ar.source_artnr = sl.source_artnr AND ar.source_dlnr = sl.source_dlnr
                        WHERE ar.piece_id = p.piece_id)) THEN 'no_source_linkage'::text
      ELSE 'unknown'::text
    END AS reason
  FROM public.pieces p
  JOIN public.pieces_marque pm ON pm.pm_id = p.piece_pm_id
  LEFT JOIN public.pieces_gamme pg ON pg.pg_id = p.piece_pg_id
  WHERE p.piece_year = 2025 AND p.piece_display = false
    AND NOT (EXISTS (SELECT 1 FROM public.v_tecdoc_activation_candidates vc WHERE vc.piece_id = p.piece_id));

-- --- Grants reproduisant l'état PROD ------------------------------------------
-- service_role = arwdDxtm (donc ÉCRITURE sur la vue auto-updatable), dev_readonly = r,
-- anon/authenticated déjà révoqués par 20260422_views_invoker_special_cases.sql.
GRANT ALL    ON public.__tecdoc_losch_log,
                public.v_tecdoc_dlnr_reconciliation,
                public.v_tecdoc_unlinked_pieces_reason TO service_role;
GRANT SELECT ON public.__tecdoc_losch_log,
                public.v_tecdoc_dlnr_reconciliation,
                public.v_tecdoc_unlinked_pieces_reason TO dev_readonly;
REVOKE ALL   ON public.__tecdoc_losch_log,
                public.v_tecdoc_dlnr_reconciliation,
                public.v_tecdoc_unlinked_pieces_reason FROM anon, authenticated;

GRANT SELECT ON public.auto_type, public.auto_modele, public.auto_marque,
                public.pieces, public.pieces_marque, public.pieces_gamme,
                public.pieces_relation_type, public.__tecdoc_supplier_mapping,
                public.v_tecdoc_activation_candidates
             TO anon, authenticated, service_role, dev_readonly;

-- --- PORTE 1 : la fonction morte, EXECUTE à PUBLIC ----------------------------
-- Corps verbatim (prod). tecdoc_raw.t200 n'existe pas : la branche '200' lève 42P01,
-- toute autre valeur renvoie 0 sans rien faire.
CREATE FUNCTION public.__load_tecdoc_raw(p_table_id text, p_rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'tecdoc_raw'
AS $function$
DECLARE
  row_count INTEGER := 0;
  r JSONB;
BEGIN
  IF p_table_id = '200' THEN
    FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
      INSERT INTO tecdoc_raw.t200 (artnr) VALUES (r->>'artnr');
      row_count := row_count + 1;
    END LOOP;
  END IF;
  RETURN row_count;
END;
$function$;

-- --- PORTE 5 : la fonction runtime, EXECUTE à PUBLIC, search_path='public' ----
CREATE FUNCTION public.resolve_type_id_remap(p_old_id integer)
RETURNS TABLE(new_id integer, type_alias text, type_name text, modele_alias text, modele_id integer, marque_alias text, marque_id smallint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT r.new_id, at.type_alias, at.type_name,
         am.modele_alias, am.modele_id,
         amarq.marque_alias, amarq.marque_id
  FROM tecdoc_map.type_id_remap r
  JOIN auto_type at ON at.type_id = r.new_id::text
  JOIN auto_modele am ON am.modele_id::text = at.type_modele_id
  JOIN auto_marque amarq ON amarq.marque_id = am.modele_marque_id
  WHERE r.old_id = p_old_id LIMIT 1;
$function$;
