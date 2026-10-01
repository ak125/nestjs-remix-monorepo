-- =============================================================================
-- Migration : extensions pg_trgm et unaccent déplacées de `public` vers
--             `extensions`, et search_path des 8 fonctions qui les appellent
-- Date      : 2026-10-01
-- Severity  : LOW
-- Scope     : ALTER EXTENSION pg_trgm / unaccent SET SCHEMA extensions ;
--             ALTER FUNCTION … SET search_path sur 8 fonctions de `public`.
--             Aucun corps de fonction réécrit, aucune table, aucune donnée,
--             aucun droit, aucun job pg_cron touché.
-- Forward-only. Rollback documentaire : fichier .down.sql voisin.
-- =============================================================================
--
-- POURQUOI
-- --------
-- L'advisor Supabase `extension_in_public` signale trois extensions installées
-- dans `public` : vector (migration 20261001_move_vector_extension_to_extensions_schema),
-- pg_trgm et unaccent (cette migration). `public` est le schéma de l'API et celui
-- de l'application : pg_trgm y dépose 47 objets (fonctions similarity, show_limit,
-- set_limit…, opérateurs %, <->…, classes d'opérateurs gin_trgm_ops et
-- gist_trgm_ops), unaccent 6 (fonctions unaccent, dictionnaire et modèle de
-- recherche plein texte). Le déplacement les range avec les autres extensions et
-- retire de `public` tout risque de collision de nom avec l'application.
-- Effet de bord sur l'API, mesuré le 2026-10-01 : show_limit (pg_trgm, sans
-- paramètre) est la seule fonction de ces deux extensions publiée par PostgREST
-- (GET /rest/v1/rpc/show_limit → 200). Hors de `public`, elle ne l'est plus.
-- Aucun code du dépôt ne l'appelle.
--
-- POURQUOI LES 8 FONCTIONS
-- ------------------------
-- Ces fonctions de `public` ont un search_path épinglé à `public` seul et
-- appellent pg_trgm ou unaccent sans qualification de schéma. Après le
-- déplacement, leur corps ne trouverait plus ces symboles. Inventaire du
-- 2026-10-01 (prosrc de toutes les fonctions sql/plpgsql hors extensions et
-- schémas système, tous schémas confondus) :
--   pg_trgm  : calculate_text_similarity, resolve_gamme_alias,
--              search_references_trigram, suggest_references (similarity) ;
--              create_index_async (gin_trgm_ops dans un CREATE INDEX dynamique) ;
--   unaccent : check_confusion_pairs, immutable_unaccent (fonction et
--              dictionnaire), evaluate_rule_condition (surcharge à 6 arguments ;
--              la surcharge à 5 arguments n'appelle pas unaccent).
-- La correction ajoute `extensions` à leur search_path épinglé, sans réécrire
-- leur corps : `public, extensions, pg_temp`. `pg_temp` en dernier ferme la
-- résolution par le schéma temporaire de session. Aucun rôle de l'API (anon,
-- authenticated, service_role) n'a CREATE sur `public` ni sur `extensions`,
-- mesure du 2026-10-01 : ajouter `extensions` au chemin de create_index_async,
-- seule fonction SECURITY DEFINER du lot, n'ouvre aucun détournement.
-- Le précontrôle vérifie, par md5 de prosrc, que chaque corps est celui de
-- l'inventaire : si une fonction a changé depuis, la migration s'arrête.
--
-- IMPACT RUNTIME : NUL — raisons vérifiées le 2026-10-01 sur la base :
--   * Les 4 index trigram (idx_pieces_ref_trgm, idx_pieces_name_trgm,
--     idx_seo_ref_title_trgm, idx_skr_kw) référencent la classe d'opérateurs
--     gin_trgm_ops par OID : ils suivent le déplacement, sans reconstruction.
--   * Aucune vue, aucun index d'expression, aucune colonne générée, aucun
--     défaut, aucune contrainte et aucune configuration de recherche plein
--     texte n'utilise pg_trgm ou unaccent.
--   * Aucun objet de même nom n'existe dans `extensions` (0 collision).
--   * Le code du dépôt appelle une seule de ces fonctions, resolve_gamme_alias
--     (module rag-proxy, par RPC). Aucun SQL brut du dépôt hors migrations
--     n'appelle similarity, unaccent ou gin_trgm_ops.
--   * Le search_path de session de `postgres` contient déjà `extensions`.
--   * Une seule transaction : les autres sessions voient le déplacement et les
--     nouveaux search_path en même temps, jamais l'un sans l'autre.
--
-- DROITS
-- ------
-- pg_trgm et unaccent appartiennent à `supabase_admin` ; `postgres` n'est pas
-- superutilisateur. supautils, chargé dans chaque session, exécute
-- `ALTER EXTENSION … SET SCHEMA` d'une extension listée dans
-- supautils.privileged_extensions (les deux le sont) sous `supabase_admin`.
-- Si l'élévation était refusée, la transaction entière serait annulée.
--
-- APPLICATION : par le moteur du dépôt uniquement (Actions → « 🗄️ Apply
-- Supabase migrations (manual) », only_ids = cet identifiant), après fusion
-- sur main — jamais par un canal qui contourne infra.schema_migrations.
-- =============================================================================

-- La règle squawk `require-timeout-settings` : délais explicites. Omis, un GUC
-- hérite du défaut du rôle (60 s pour `postgres` sur ce projet).
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Précontrôle : chaque fonction existe, appartient à `postgres`, a le corps
-- inventorié (md5 de prosrc) et un search_path de départ attendu (`public`, ou
-- déjà la valeur cible en cas de rejeu).
DO $precheck$
DECLARE
  v_expected CONSTANT text[][] := ARRAY[
    ['public.calculate_text_similarity(text, text)',                                                         '95669afe2bd3220b1e7f202b18d8a4e7', 'f'],
    ['public.check_confusion_pairs(text, character varying)',                                                '007b4073a6bc084c28dde744beadc5eb', 'f'],
    ['public.create_index_async(text, text, text, text)',                                                    'dedd0598334204cdff3ca5c944e8f0fc', 't'],
    ['public.evaluate_rule_condition(jsonb, text, character varying, integer, character varying, jsonb)',   'b626bc6f644f09f838276eb0fe039bd5', 'f'],
    ['public.immutable_unaccent(text)',                                                                      '777db0e1477b9d8791d7ca5456b921fc', 'f'],
    ['public.resolve_gamme_alias(text)',                                                                     '30fed0062010960abf8adc3de1effe83', 'f'],
    ['public.search_references_trigram(text, text, integer, integer)',                                       '341fe9715efb02ac1825b11b5c62847c', 'f'],
    ['public.suggest_references(text)',                                                                      'c4f05acb6d501e9b1b078274d188473b', 'f']
  ];
  v_oid    oid;
  v_md5    text;
  v_secdef boolean;
  v_owner  text;
  v_config text[];
BEGIN
  FOR i IN 1 .. array_length(v_expected, 1) LOOP
    v_oid := to_regprocedure(v_expected[i][1]);
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'ABORT: % introuvable', v_expected[i][1];
    END IF;

    SELECT md5(p.prosrc), p.prosecdef, pg_get_userbyid(p.proowner), p.proconfig
      INTO v_md5, v_secdef, v_owner, v_config
      FROM pg_proc p WHERE p.oid = v_oid;

    IF v_md5 <> v_expected[i][2] THEN
      RAISE EXCEPTION 'ABORT: corps de % modifié depuis l''inventaire du 2026-10-01 (md5 %)', v_expected[i][1], v_md5;
    END IF;
    IF v_owner <> 'postgres' OR v_secdef <> v_expected[i][3]::boolean THEN
      RAISE EXCEPTION 'ABORT: % owner=% prosecdef=% (attendu postgres / %)', v_expected[i][1], v_owner, v_secdef, v_expected[i][3];
    END IF;
    IF v_config IS DISTINCT FROM ARRAY['search_path=public']
       AND v_config IS DISTINCT FROM ARRAY['search_path=public, extensions, pg_temp'] THEN
      RAISE EXCEPTION 'ABORT: proconfig inattendu % pour %', v_config, v_expected[i][1];
    END IF;
  END LOOP;
END
$precheck$;

-- Sans effet si l'extension est déjà dans `extensions` (rejeu).
ALTER EXTENSION pg_trgm SET SCHEMA extensions;
ALTER EXTENSION unaccent SET SCHEMA extensions;

ALTER FUNCTION public.calculate_text_similarity(text, text)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.check_confusion_pairs(text, character varying)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.create_index_async(text, text, text, text)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.evaluate_rule_condition(jsonb, text, character varying, integer, character varying, jsonb)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.immutable_unaccent(text)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.resolve_gamme_alias(text)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.search_references_trigram(text, text, integer, integer)
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.suggest_references(text)
  SET search_path = public, extensions, pg_temp;

-- Postcheck fail-closed :
--   1. les deux extensions, tous leurs membres et leurs types tableau sont dans
--      `extensions` ;
--   2. chaque index sur une classe d'opérateurs de pg_trgm est resté valide ;
--   3. les 8 fonctions ont le search_path cible et leur corps inchangé ;
--   4. les 7 fonctions sans effet de bord s'exécutent et résolvent pg_trgm /
--      unaccent (lectures seules, < 60 ms chacune mesurées le 2026-10-01) ;
--      create_index_async, qui crée un index, n'est pas exécutée : on vérifie
--      que gin_trgm_ops est dans un schéma de son search_path.
DO $postcheck$
DECLARE
  v_ext     record;
  v_left    integer;
  v_invalid integer;
  v_bad     integer;
BEGIN
  FOR v_ext IN
    SELECT e.oid, e.extname, n.nspname
      FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
     WHERE e.extname IN ('pg_trgm', 'unaccent')
  LOOP
    IF v_ext.nspname <> 'extensions' THEN
      RAISE EXCEPTION 'postcheck: extension % dans le schéma %, attendu extensions', v_ext.extname, v_ext.nspname;
    END IF;

    SELECT count(*) INTO v_left
      FROM pg_depend d
      CROSS JOIN LATERAL pg_identify_object(d.classid, d.objid, d.objsubid) o
     WHERE d.refclassid = 'pg_extension'::regclass
       AND d.refobjid = v_ext.oid
       AND d.deptype = 'e'
       AND o.schema IS DISTINCT FROM 'extensions'
       AND o.schema IS NOT NULL;

    v_left := v_left + (
      SELECT count(*)
        FROM pg_type arr
        JOIN pg_depend d ON d.classid = 'pg_type'::regclass
                        AND d.objid = arr.typelem
                        AND d.refclassid = 'pg_extension'::regclass
                        AND d.refobjid = v_ext.oid
                        AND d.deptype = 'e'
       WHERE arr.typnamespace <> 'extensions'::regnamespace
    );

    IF v_left > 0 THEN
      RAISE EXCEPTION 'postcheck: % objet(s) de % hors du schéma extensions', v_left, v_ext.extname;
    END IF;
  END LOOP;

  IF (SELECT count(*) FROM pg_extension WHERE extname IN ('pg_trgm', 'unaccent')) <> 2 THEN
    RAISE EXCEPTION 'postcheck: pg_trgm ou unaccent absente';
  END IF;

  SELECT count(*) INTO v_invalid
    FROM pg_index i
   WHERE NOT (i.indisvalid AND i.indisready)
     AND EXISTS (
       SELECT 1
         FROM unnest(i.indclass::oid[]) AS c(opc)
         JOIN pg_depend d ON d.classid = 'pg_opclass'::regclass
                         AND d.objid = c.opc
                         AND d.refclassid = 'pg_extension'::regclass
                         AND d.deptype = 'e'
         JOIN pg_extension e ON e.oid = d.refobjid AND e.extname = 'pg_trgm'
     );
  IF v_invalid > 0 THEN
    RAISE EXCEPTION 'postcheck: % index sur une classe d''opérateurs de pg_trgm non valide(s)', v_invalid;
  END IF;

  SELECT count(*) INTO v_bad
    FROM (VALUES
      ('public.calculate_text_similarity(text, text)',                                                       '95669afe2bd3220b1e7f202b18d8a4e7'),
      ('public.check_confusion_pairs(text, character varying)',                                              '007b4073a6bc084c28dde744beadc5eb'),
      ('public.create_index_async(text, text, text, text)',                                                  'dedd0598334204cdff3ca5c944e8f0fc'),
      ('public.evaluate_rule_condition(jsonb, text, character varying, integer, character varying, jsonb)', 'b626bc6f644f09f838276eb0fe039bd5'),
      ('public.immutable_unaccent(text)',                                                                    '777db0e1477b9d8791d7ca5456b921fc'),
      ('public.resolve_gamme_alias(text)',                                                                   '30fed0062010960abf8adc3de1effe83'),
      ('public.search_references_trigram(text, text, integer, integer)',                                     '341fe9715efb02ac1825b11b5c62847c'),
      ('public.suggest_references(text)',                                                                    'c4f05acb6d501e9b1b078274d188473b')
    ) AS x(sig, md5)
    LEFT JOIN pg_proc p ON p.oid = to_regprocedure(x.sig)
   WHERE p.oid IS NULL
      OR md5(p.prosrc) <> x.md5
      OR p.proconfig IS DISTINCT FROM ARRAY['search_path=public, extensions, pg_temp'];
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'postcheck: % fonction(s) sans le search_path cible ou au corps modifié', v_bad;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_opclass c JOIN pg_am a ON a.oid = c.opcmethod
     WHERE c.opcname = 'gin_trgm_ops' AND a.amname = 'gin'
       AND c.opcnamespace = 'extensions'::regnamespace
  ) THEN
    RAISE EXCEPTION 'postcheck: gin_trgm_ops absente du schéma extensions (create_index_async)';
  END IF;

  IF public.immutable_unaccent('Frein arrière') IS DISTINCT FROM 'Frein arriere' THEN
    RAISE EXCEPTION 'postcheck: immutable_unaccent ne résout pas unaccent';
  END IF;
  IF (public.calculate_text_similarity('plaquette de frein', 'plaquettes de frein')->>'similarity')::numeric <= 0 THEN
    RAISE EXCEPTION 'postcheck: calculate_text_similarity ne résout pas similarity';
  END IF;
  IF public.evaluate_rule_condition(
       '{"type": "content_check", "pattern": "Arrière", "operator": "present"}'::jsonb,
       'Le frein ARRIERE') IS NOT TRUE THEN
    RAISE EXCEPTION 'postcheck: evaluate_rule_condition ne résout pas unaccent';
  END IF;
  PERFORM public.check_confusion_pairs('Disque de frein et plaquette', 'body');
  PERFORM count(*) FROM public.resolve_gamme_alias('filtre');
  PERFORM count(*) FROM public.search_references_trigram('frein', '', 1, 1);
  PERFORM count(*) FROM public.suggest_references('frein');
END
$postcheck$;
