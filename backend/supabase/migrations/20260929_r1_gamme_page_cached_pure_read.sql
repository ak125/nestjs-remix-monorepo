-- Migration : get_gamme_page_data_cached() devient une LECTURE PURE — sur un
-- cache absent ou périmé elle construit le payload à la volée et le renvoie,
-- sans rien écrire.
--
-- PROBLÈME (lu en lecture seule sur la base live le 2026-09-29) :
--   get_gamme_page_data_cached est STABLE SECURITY DEFINER. Sur un cache absent
--   ou périmé, son corps live appelle public.rebuild_gamme_page_cache(p_pg_id),
--   fonction VOLATILE qui ÉCRIT dans __gamme_page_cache (INSERT … ON CONFLICT,
--   UPDATE, ou DELETE si le payload est NULL). PostgREST exécute une fonction
--   STABLE dans une transaction READ ONLY : toute écriture y lève SQLSTATE 25006.
--   Reproduit en transaction READ ONLY sur la base live :
--     pg_id 14 (gamme sans ligne de cache)   -> « cannot execute INSERT in a read-only transaction »
--     pg_id 97 (payload NULL, pas de ligne)  -> « cannot execute DELETE in a read-only transaction »
--   Le défaut était déjà consigné dans
--   audit/massdoc-verification-avant-fenetre-pg-2026-09-17.md (« fonction STABLE
--   appelant un écrivain VOLATILE -> 25006 »), et la dette « scinder lecture
--   pure / rebuild » dans scripts/lint/definer-anon-allowlist.txt.
--
-- CE QUE LE DÉFAUT PRODUIT AUJOURD'HUI (mesuré le 2026-09-29) :
--   - __gamme_page_cache : 238 lignes, 0 périmée, toutes construites le
--     2026-04-27. Aucune ligne n'a pu être ajoutée depuis par ce chemin.
--   - 3 973 gammes affichées (pg_display = '1') n'ont pas de ligne : niveau 0
--     = 3 970, niveau 4 = 1, niveau 5 = 2.
--   - Pour chacune, l'endpoint RPC V2 répond 503 (25006) ; le frontend retombe
--     alors sur l'endpoint classique, dont la réponse n'a pas de `hero`, et le
--     loader de pieces.$slug.tsx répond 404. Sur ces URL, le 404 servi vient
--     donc de l'erreur 25006, pas d'une décision de catalogue.
--   - refresh_stale_gamme_cache (pg_cron job 14, toutes les 10 min) ne parcourt
--     que les lignes EXISTANTES marquées stale : il ne remplit jamais une ligne
--     absente.
--
-- DÉCISION — lecture pure, et non VOLATILE :
--   - Passer la fonction en VOLATILE ferait disparaître 25006, mais ferait
--     écrire (INSERT, UPDATE, DELETE) dans __gamme_page_cache à chaque lecture
--     publique non servie par le cache : robots compris, sur un chemin qu'anon
--     exécute. Refusé.
--   - Retenu : sur absent ou périmé, RETURN build_gamme_page_payload(p_pg_id).
--     C'est exactement le payload que rebuild_gamme_page_cache aurait stocké
--     (il stocke v_payload sans le modifier) : aucune identité de payload n'est
--     perdue. La persistance reste aux écrivains qui ont le droit d'écrire :
--     refresh_stale_gamme_cache (cron) et la reconstruction admin.
--
-- EFFET SERVI (mesuré sur la base live, échantillon de 80 gammes non cachées) :
--   - L'endpoint V2 renvoie désormais le payload (avec `hero`) au lieu d'un 503 ;
--     le repli frontend vers l'endpoint classique n'est plus emprunté pour ces
--     gammes.
--   - Le statut servi suit alors les gardes existantes du loader, inchangées :
--     52/80 « gamme_empty » -> 410 + X-Robots-Tag noindex ; 28/80
--     « vehicle_incomplete » -> 200 ; 301 si le slug ne correspond pas à l'alias.
--   - Les pages en 200 portent meta robots « noindex, nofollow » : le builder
--     (gamme-response-builder.service.ts) n'indexe que pg_level = '1', et aucune
--     de ces 3 973 gammes n'est de niveau 1. Donc 0 nouvelle page indexable,
--     0 URL créée ni modifiée.
--   - Payload NULL (416 gammes, aucune affichée ; exemple pg_id 97) : la
--     fonction renvoie NULL, le backend répond 404 comme avant.
--   - Cache présent et non périmé (238 gammes) : strictement inchangé.
--
-- CE QUI N'EST PAS TOUCHÉ (délibérément) :
--   - Les droits de la fonction (ACL et propriétaire) : CREATE OR REPLACE les
--     conserve, et la vérification ci-dessous refuse la migration si l'ACL
--     change. La fermeture de PUBLIC et authenticated relève d'une autre
--     migration.
--   - rebuild_gamme_page_cache, build_gamme_page_payload,
--     refresh_stale_gamme_cache, le job pg_cron 14 et __gamme_page_cache.
--   - get_vehicle_page_data_cached (R8) : même défaut de conception, mais elle
--     est VOLATILE ; hors périmètre, suivie en dette dans l'allowlist.
--   - Aucune table, colonne, valeur d'enum, index ni job pg_cron créé.
--
-- COÛT : sur absent ou périmé, le builder coûte 3,5 ms en moyenne (5,1 ms au
--   maximum, 28 gammes mesurées). L'ancien corps payait déjà ce coût, puis
--   échouait ; il n'y a plus d'écriture ni d'appel classique en repli.
--
-- VERROUS : CREATE OR REPLACE FUNCTION ne modifie que le catalogue : aucun
--   verrou de table, aucune réécriture. lock_timeout court : en cas d'attente,
--   l'application échoue proprement au lieu de bloquer.
--
-- DROITS : inchangés. SECURITY DEFINER conservé (anon doit pouvoir lire
--   __gamme_page_cache et appeler le builder, tous deux fermés à anon ;
--   entrée motivée de scripts/lint/definer-anon-allowlist.txt). search_path
--   ré-affirmé à public : CREATE OR REPLACE remplace proconfig.
--
-- VÉRIFICATION À L'APPLICATION (dans cette transaction, fail-closed) :
--   - avant : fonction présente, DEFINER, renvoie json ; builder présent, non
--     VOLATILE (une fonction STABLE ne peut pas écrire), DEFINER, renvoie jsonb ;
--   - après : STABLE, DEFINER, search_path = public, ACL identique, aucun appel
--     à rebuild_gamme_page_cache ni instruction d'écriture dans le corps ;
--   - sonde fonctionnelle en transaction READ ONLY (le contexte de PostgREST),
--     dans une sous-transaction annulée ensuite : un cache absent ne lève plus
--     25006 ; un cache présent renvoie exactement sa ligne.
--
-- ROLLBACK : 20260929_r1_gamme_page_cached_pure_read.down.sql (restaure verbatim
--   le corps live du 2026-09-29 ; il réintroduit 25006 — lire son en-tête).
--
-- Test de comportement (PostgreSQL 17 jetable, sans réseau) :
--   bash scripts/db/test-r1-gamme-page-cached-pure-read.sh
--
-- Le runner (scripts/ci/apply-supabase-migration.py) wrappe le fichier dans une
-- transaction (squawk: assume_in_transaction).

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15s';

DO $precheck$
DECLARE
  v_fn  regprocedure := to_regprocedure('public.get_gamme_page_data_cached(integer)');
  v_bld regprocedure := to_regprocedure('public.build_gamme_page_payload(integer)');
BEGIN
  IF v_fn IS NULL THEN
    RAISE EXCEPTION 'r1 precheck : public.get_gamme_page_data_cached(integer) introuvable';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
     WHERE oid = v_fn AND prosecdef AND prorettype = 'json'::regtype
  ) THEN
    RAISE EXCEPTION 'r1 precheck : get_gamme_page_data_cached n''est plus SECURITY DEFINER / json — état live différent de celui mesuré, ne pas appliquer à l''aveugle';
  END IF;
  IF v_bld IS NULL OR NOT EXISTS (
    SELECT 1 FROM pg_proc
     WHERE oid = v_bld AND prosecdef AND provolatile IN ('s', 'i')
       AND prorettype = 'jsonb'::regtype
  ) THEN
    RAISE EXCEPTION 'r1 precheck : build_gamme_page_payload(integer) absente, VOLATILE, non DEFINER ou ne renvoyant pas jsonb — la lecture pure n''est plus garantie';
  END IF;
  -- ACL de référence, relue par la vérification finale.
  PERFORM set_config('r1_pure_read.acl_before',
                     (SELECT coalesce(proacl::text, '') FROM pg_proc WHERE oid = v_fn),
                     true);
END;
$precheck$;

CREATE OR REPLACE FUNCTION public.get_gamme_page_data_cached(p_pg_id integer)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cached_payload JSONB;
  v_cached_stale   BOOLEAN;
BEGIN
  SELECT payload, stale
    INTO v_cached_payload, v_cached_stale
    FROM public.__gamme_page_cache
    WHERE pg_id = p_pg_id;

  IF v_cached_payload IS NOT NULL AND v_cached_stale = FALSE THEN
    RETURN v_cached_payload::JSON;
  END IF;

  -- Absent ou périmé : construire à la volée, sans écrire. PostgREST exécute
  -- une fonction STABLE en transaction READ ONLY ; la persistance appartient à
  -- refresh_stale_gamme_cache (pg_cron) et à la reconstruction admin.
  RETURN public.build_gamme_page_payload(p_pg_id)::JSON;
END;
$function$;

COMMENT ON FUNCTION public.get_gamme_page_data_cached(integer) IS
  'R1 : payload de page gamme. Cache présent et non périmé -> ligne de __gamme_page_cache ; sinon build_gamme_page_payload à la volée, SANS écriture (lecture pure, compatible avec la transaction READ ONLY de PostgREST). Persistance : refresh_stale_gamme_cache (pg_cron) et reconstruction admin (20260929).';

DO $postcheck$
DECLARE
  v_fn       regprocedure := 'public.get_gamme_page_data_cached(integer)'::regprocedure;
  v_miss_id  integer;
  v_hit_id   integer;
  v_hit_row  text;
  v_result   json;
  v_state    text;
  v_msg      text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
     WHERE oid = v_fn
       AND provolatile = 's'
       AND prosecdef
       AND proconfig = ARRAY['search_path=public']
       AND prosrc !~* '(rebuild_gamme_page_cache|\minsert\M|\mupdate\M|\mdelete\M)'
  ) THEN
    RAISE EXCEPTION 'r1 postcheck : corps, volatilité, DEFINER ou search_path inattendus après remplacement';
  END IF;
  IF (SELECT coalesce(proacl::text, '') FROM pg_proc WHERE oid = v_fn)
     IS DISTINCT FROM current_setting('r1_pure_read.acl_before', true) THEN
    RAISE EXCEPTION 'r1 postcheck : l''ACL a changé — cette migration ne doit toucher aucun droit';
  END IF;

  -- Sonde 1 : cache ABSENT, en transaction READ ONLY. transaction_read_only ne
  -- peut que passer à « on » en cours de transaction ; la sous-transaction est
  -- ensuite annulée par une exception sentinelle, ce qui restaure le mode
  -- lecture-écriture pour la suite (dont l'écriture du registre par le runner).
  SELECT coalesce(max(pg_id), 0) + 1 INTO v_miss_id FROM public.__gamme_page_cache;
  BEGIN
    PERFORM set_config('transaction_read_only', 'on', true);
    v_result := public.get_gamme_page_data_cached(v_miss_id);
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'r1_pure_read_probe_done';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
  END;
  IF v_msg IS DISTINCT FROM 'r1_pure_read_probe_done' THEN
    RAISE EXCEPTION 'r1 postcheck : cache absent (pg_id %) en transaction READ ONLY -> % %', v_miss_id, v_state, v_msg;
  END IF;
  IF current_setting('transaction_read_only') <> 'off' THEN
    RAISE EXCEPTION 'r1 postcheck : transaction_read_only non restauré après la sonde';
  END IF;

  -- Sonde 2 : cache PRÉSENT et non périmé -> exactement la ligne stockée.
  SELECT pg_id, payload::text INTO v_hit_id, v_hit_row
    FROM public.__gamme_page_cache WHERE stale = FALSE ORDER BY pg_id LIMIT 1;
  IF v_hit_id IS NOT NULL THEN
    v_msg := NULL;
    BEGIN
      PERFORM set_config('transaction_read_only', 'on', true);
      v_result := public.get_gamme_page_data_cached(v_hit_id);
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'r1_pure_read_probe_done';
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
    END;
    IF v_msg IS DISTINCT FROM 'r1_pure_read_probe_done' THEN
      RAISE EXCEPTION 'r1 postcheck : cache présent (pg_id %) en transaction READ ONLY -> % %', v_hit_id, v_state, v_msg;
    END IF;
    IF v_result::text IS DISTINCT FROM v_hit_row THEN
      RAISE EXCEPTION 'r1 postcheck : cache présent (pg_id %) — le résultat diffère de la ligne stockée', v_hit_id;
    END IF;
  END IF;
END;
$postcheck$;
