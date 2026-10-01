-- =============================================================================
-- Migration : placer pg_temp en DERNIER dans le search_path de 3 fonctions
--             SECURITY DEFINER du domaine commande
-- Date      : 2026-10-01
-- Scope     : TROIS fonctions, UN attribut chacune (proconfig). AUCUN corps
--             réécrit, aucun droit modifié, aucune table touchée, aucune donnée
--             lue ni écrite.
--               * public.create_order_atomic(jsonb, jsonb, uuid)
--               * public.append_order_event(text, text, text, text, jsonb, text, uuid, bigint)
--               * public.check_payment_tunnel_health(integer)
-- Forward-only. Ne réécrit AUCUNE migration historique.
-- Zone commande / paiement : ne s'applique qu'après accord nominatif de l'owner
-- sur CETTE liste et CET attribut (même forme que 20260930_pin_mark_order_paid_
-- atomic_search_path.sql, accord du 2026-09-30).
-- =============================================================================
--
-- CONTEXTE
-- --------
-- Les trois fonctions portent `search_path=public` (mesure du 2026-10-01). Un
-- search_path qui ne liste pas pg_temp le parcourt implicitement EN PREMIER pour
-- les relations et les types (documentation PostgreSQL, « Writing SECURITY
-- DEFINER Functions Safely » et paramètre search_path). Une table temporaire
-- homonyme créée par la session appelante serait donc lue ou écrite à la place
-- de la vraie, avec les droits du propriétaire (postgres).
--
--   * create_order_atomic : `INSERT INTO "___xtr_order"` et
--     `INSERT INTO "___xtr_order_line"` SANS schéma — exposition réelle ;
--   * check_payment_tunnel_health (LANGUAGE sql, lue par
--     scripts/monitoring/check-payment-tunnel.sh) : trois lectures de
--     `___xtr_order` SANS schéma — un masquage fausserait la sonde du tunnel ;
--   * append_order_event : relations déjà qualifiées (`public.___xtr_order_
--     history`) ; seul le parcours des noms de type reste exposé.
--
-- Exploitation actuelle : il faut une session SQL arbitraire (anon et
-- authenticated n'ont pas EXECUTE ; PostgREST n'offre pas de SQL libre). C'est
-- de la défense en profondeur, alignée sur mark_order_paid_atomic (#1643),
-- auth_email_exists et auth_resolve_user.
--
-- HORS PÉRIMÈTRE, VOLONTAIREMENT :
--   * cancel_order_atomic : la PR ouverte #1549 la redéfinit par
--     CREATE OR REPLACE … SET search_path = public (sans contrôle de proconfig).
--     L'inclure ici rendrait les deux migrations incompatibles (l'empreinte du
--     corps changerait, ou #1549 retirerait pg_temp sans le dire). Ses relations
--     sont déjà toutes qualifiées `public.` ; son search_path se règle dans
--     #1549 ou après elle.
--   * les autres fonctions DEFINER de public en `search_path=public` : hors
--     domaine commande, chacune exige sa propre vérification de rendu.
--
-- VALEUR : `public, pg_temp` — celle de mark_order_paid_atomic, auth_email_
-- exists et auth_resolve_user. pg_catalog reste parcouru implicitement en
-- premier : now(), COALESCE, jsonb_array_elements, make_interval et les casts se
-- résolvent à l'identique ; les fonctions ne sont jamais cherchées dans pg_temp.
--
-- POURQUOI LE COMPORTEMENT NE CHANGE PAS — vérifié le 2026-10-01 :
--   * une seule surcharge par nom ; `___xtr_order`, `___xtr_order_line` et
--     `___xtr_order_history` n'existent que dans public ; aucun trigger
--     utilisateur ni règle sur ces tables ; aucun SQL dynamique ni CREATE TEMP
--     dans les trois corps ;
--   * plpgsql_check 2.8 (extensions), sous `SET search_path = public, pg_temp`,
--     avec extra_warnings et security_warnings : 0 anomalie pour
--     create_order_atomic et append_order_event (check_payment_tunnel_health est
--     en LANGUAGE sql : ses trois SELECT, planifiés sous ce search_path, se
--     résolvent sur public.___xtr_order sans erreur) ;
--   * appelants : orders.service.ts (create_order_atomic), order-status.service.ts
--     (append_order_event), check-payment-tunnel.sh (check_payment_tunnel_health),
--     tous via supabase.rpc / PostgREST avec service_role, dont le chemin
--     contient public ;
--   * EXECUTE : postgres et service_role seulement (proacl) — inchangé ici.
--
-- IDEMPOTENT ET REJOUABLE : ALTER FUNCTION … SET réécrit la même valeur.
--
-- APPLICATION : par le moteur du dépôt uniquement (Actions → « 🗄️ Apply
-- Supabase migrations (manual) », only_ids = cet identifiant), après fusion sur
-- main — jamais par un canal qui contourne infra.schema_migrations.
--
-- ROLLBACK : 20261001_pin_order_functions_search_path.down.sql
-- (SET search_path = public, l'état mesuré), à lancer à la main : le moteur est
-- forward-only.
-- =============================================================================

-- Pas de BEGIN/COMMIT explicite : le moteur applique ce fichier dans une
-- transaction (.squawk.toml `assume_in_transaction = true`). SET LOCAL borne les
-- délais à cette transaction. ALTER FUNCTION n'écrit qu'une ligne de pg_proc et
-- ne verrouille aucune table de données.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- -----------------------------------------------------------------------------
-- §0 — PRÉ-CONDITIONS FAIL-CLOSED (lecture de catalogue uniquement)
-- -----------------------------------------------------------------------------
-- Chaque fonction existe sous cette seule signature, reste SECURITY DEFINER,
-- appartient à postgres, et son corps est celui mesuré le 2026-10-01. Toute
-- divergence = ABORT : la preuve plpgsql_check ne couvre que ces corps-là.
-- proconfig vaut l'état mesuré ({search_path=public}) ou la cible (rejeu).
DO $precheck$
DECLARE
  r        record;
  v_oid    oid;
  v_n      int;
  v_secdef boolean;
  v_owner  text;
  v_md5    text;
  v_config text[];
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('create_order_atomic',
       'public.create_order_atomic(jsonb, jsonb, uuid)',
       '6c0d8e09318f059651920b8a2a214644'),
      ('append_order_event',
       'public.append_order_event(text, text, text, text, jsonb, text, uuid, bigint)',
       '462d75ab06d32fc3c821738f1a76f249'),
      ('check_payment_tunnel_health',
       'public.check_payment_tunnel_health(integer)',
       'a88b5ebd6e29b7f0e9dc21f2e4d944db')
    ) AS t(fname, sig, md5)
  LOOP
    v_oid := to_regprocedure(r.sig);
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'ABORT: % introuvable', r.sig;
    END IF;

    SELECT count(*) INTO v_n
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = r.fname;
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'ABORT: % surcharges de %, 1 attendue', v_n, r.fname;
    END IF;

    SELECT p.prosecdef, pg_get_userbyid(p.proowner), md5(p.prosrc), p.proconfig
      INTO v_secdef, v_owner, v_md5, v_config
      FROM pg_proc p WHERE p.oid = v_oid;

    IF NOT v_secdef OR v_owner <> 'postgres' THEN
      RAISE EXCEPTION 'ABORT: % prosecdef=% owner=% (attendu true / postgres)', r.fname, v_secdef, v_owner;
    END IF;
    IF v_md5 <> r.md5 THEN
      RAISE EXCEPTION 'ABORT: corps de % modifié depuis la mesure du 2026-10-01 (md5 %)', r.fname, v_md5;
    END IF;
    IF v_config IS DISTINCT FROM ARRAY['search_path=public']
       AND v_config IS DISTINCT FROM ARRAY['search_path=public, pg_temp'] THEN
      RAISE EXCEPTION 'ABORT: proconfig inattendu pour % : % — état de départ différent de la mesure', r.fname, v_config;
    END IF;
  END LOOP;
END
$precheck$;

-- -----------------------------------------------------------------------------
-- §1 — ÉPINGLAGE
-- -----------------------------------------------------------------------------
ALTER FUNCTION public.create_order_atomic(jsonb, jsonb, uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.append_order_event(text, text, text, text, jsonb, text, uuid, bigint)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.check_payment_tunnel_health(integer)
  SET search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- §2 — POST-CONDITIONS FAIL-CLOSED
-- -----------------------------------------------------------------------------
-- proconfig porte exactement la valeur visée ; corps, propriétaire, SECURITY
-- DEFINER et droits EXECUTE sont inchangés.
DO $postcheck$
DECLARE
  r     record;
  v_oid oid;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('public.create_order_atomic(jsonb, jsonb, uuid)',
       '6c0d8e09318f059651920b8a2a214644'),
      ('public.append_order_event(text, text, text, text, jsonb, text, uuid, bigint)',
       '462d75ab06d32fc3c821738f1a76f249'),
      ('public.check_payment_tunnel_health(integer)',
       'a88b5ebd6e29b7f0e9dc21f2e4d944db')
    ) AS t(sig, md5)
  LOOP
    v_oid := r.sig::regprocedure;

    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
       WHERE p.oid = v_oid
         AND p.prosecdef
         AND pg_get_userbyid(p.proowner) = 'postgres'
         AND md5(p.prosrc) = r.md5
         AND p.proconfig = ARRAY['search_path=public, pg_temp']
    ) THEN
      RAISE EXCEPTION 'ABORT: état de % inattendu après ALTER', r.sig;
    END IF;

    IF has_function_privilege('anon', v_oid, 'EXECUTE')
       OR has_function_privilege('authenticated', v_oid, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'ABORT: droits EXECUTE inattendus sur % (attendu : service_role seul côté API)', r.sig;
    END IF;
  END LOOP;
END
$postcheck$;

-- =============================================================================
-- Vérification post-migration (lecture seule, à jouer après apply)
-- =============================================================================
--   SELECT p.oid::regprocedure, p.proconfig, md5(p.prosrc), p.proacl
--     FROM pg_proc p
--    WHERE p.oid IN ('public.create_order_atomic(jsonb, jsonb, uuid)'::regprocedure,
--                    'public.append_order_event(text, text, text, text, jsonb, text, uuid, bigint)'::regprocedure,
--                    'public.check_payment_tunnel_health(integer)'::regprocedure);
--   -- attendu : {"search_path=public, pg_temp"} sur les 3, md5 inchangés,
--   --           {postgres=X/postgres,service_role=X/postgres}
-- =============================================================================
