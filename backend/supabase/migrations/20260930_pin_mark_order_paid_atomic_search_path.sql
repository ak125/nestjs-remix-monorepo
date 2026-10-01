-- =============================================================================
-- Migration : épingler le search_path de public.mark_order_paid_atomic(text, text)
-- Date      : 2026-09-30
-- Severity  : WARN (advisor Supabase function_search_path_mutable — dernière entrée)
-- Scope     : UNE fonction, UN attribut (proconfig). AUCUN corps réécrit, aucun
--             droit modifié, aucune table touchée, aucune donnée lue ni écrite.
-- Forward-only. Ne réécrit AUCUNE migration historique.
-- Zone paiement/commande : accord nominatif de l'owner du 2026-09-30, question
-- posée sur CETTE fonction et CET attribut, réponse « Oui, modifie-la ». L'accord
-- couvre le search_path de mark_order_paid_atomic et rien d'autre : ni le corps,
-- ni les droits, ni les données, ni les autres fonctions du domaine commande.
-- =============================================================================
--
-- CONTEXTE
-- --------
-- 20260616_vague5_pin_function_search_path.sql a épinglé le search_path de 334
-- fonctions de public et a EXCLU trois fonctions au titre du carve-out paiement
-- (docs/security/vague5-rls-drift-tail-20260616.md §7) : auth_email_exists,
-- auth_resolve_user et mark_order_paid_atomic. Les deux premières portent depuis
-- `search_path=public, pg_temp`. mark_order_paid_atomic est la dernière : mesure
-- du 2026-09-30, c'est l'UNIQUE fonction de public (hors extensions, tous types)
-- sans search_path épinglé.
--
-- Elle est SECURITY DEFINER (propriétaire postgres) et référence la table
-- `"___xtr_order"` sans schéma. Sans search_path épinglé, la résolution dépend de
-- l'appelant ; et comme pg_temp n'est pas listé, le schéma temporaire de la
-- session est parcouru EN PREMIER pour les relations : une table temporaire
-- homonyme créée par l'appelant serait mise à jour à la place de la vraie, avec
-- les droits du propriétaire.
--
-- VALEUR : `public, pg_temp`
--   * pg_temp en DERNIER est la forme recommandée par la documentation
--     PostgreSQL pour une fonction SECURITY DEFINER (« Writing SECURITY DEFINER
--     Functions Safely ») : un search_path qui ne liste pas pg_temp le parcourt
--     implicitement EN PREMIER pour les relations ;
--   * c'est la valeur exacte des deux fonctions sœurs du même carve-out
--     (auth_email_exists, auth_resolve_user).
--   Les trois autres fonctions DEFINER du domaine commande (create_order_atomic,
--   cancel_order_atomic, append_order_event) portent `search_path=public`, sans
--   pg_temp (mesure du 2026-09-30). On ne s'aligne PAS sur elles : ce serait
--   reproduire le parcours implicite de pg_temp en premier. Les corriger sort de
--   l'accord de cette migration.
--   pg_catalog reste parcouru implicitement en premier : now(), COALESCE et le
--   cast ::TEXT se résolvent à l'identique.
--
-- POURQUOI LE COMPORTEMENT NE CHANGE PAS — vérifié le 2026-09-30 :
--   * unique appelant : backend/src/modules/payments/repositories/
--     payment-data.service.ts (supabase.rpc, rôle service_role), dont le chemin de
--     recherche PostgREST contient public : `"___xtr_order"` s'y résout déjà en
--     public.___xtr_order ;
--   * plpgsql_check 2.8 (extensions), sous `SET search_path = public, pg_temp`,
--     avec extra_warnings et security_warnings : 0 anomalie ;
--   * EXECUTE : postgres et service_role seulement (proacl) — inchangé ici.
--
-- IDEMPOTENT ET REJOUABLE : ALTER FUNCTION … SET réécrit la même valeur.
--
-- APPLICATION : par le moteur du dépôt uniquement (Actions → « 🗄️ Apply
-- Supabase migrations (manual) », only_ids = cet identifiant), après fusion sur
-- main — jamais par un canal qui contourne infra.schema_migrations.
--
-- ROLLBACK : 20260930_pin_mark_order_paid_atomic_search_path.down.sql
-- (RESET search_path), à lancer à la main : le moteur est forward-only.
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
-- La fonction existe sous cette seule signature, reste SECURITY DEFINER,
-- appartient à postgres, et son corps est celui mesuré le 2026-09-30
-- (md5(prosrc) = e1501c95b02ce13f76123373f9ab2bf5, 281 caractères, issu de
-- 20260417_fix_mark_order_paid_atomic_type_error.sql). Toute divergence = ABORT :
-- la preuve plpgsql_check ne couvre que ce corps-là.
DO $precheck$
DECLARE
  v_oid     oid := to_regprocedure('public.mark_order_paid_atomic(text, text)');
  v_n       int;
  v_secdef  boolean;
  v_owner   text;
  v_md5     text;
  v_config  text[];
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'ABORT: public.mark_order_paid_atomic(text, text) introuvable';
  END IF;

  SELECT count(*) INTO v_n
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'mark_order_paid_atomic';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ABORT: % surcharges de mark_order_paid_atomic, 1 attendue', v_n;
  END IF;

  SELECT p.prosecdef, pg_get_userbyid(p.proowner), md5(p.prosrc), p.proconfig
    INTO v_secdef, v_owner, v_md5, v_config
    FROM pg_proc p WHERE p.oid = v_oid;

  IF NOT v_secdef OR v_owner <> 'postgres' THEN
    RAISE EXCEPTION 'ABORT: prosecdef=% owner=% (attendu true / postgres)', v_secdef, v_owner;
  END IF;
  IF v_md5 <> 'e1501c95b02ce13f76123373f9ab2bf5' THEN
    RAISE EXCEPTION 'ABORT: corps modifié depuis la mesure du 2026-09-30 (md5 %)', v_md5;
  END IF;
  IF v_config IS NOT NULL
     AND v_config IS DISTINCT FROM ARRAY['search_path=public, pg_temp'] THEN
    RAISE EXCEPTION 'ABORT: proconfig inattendu % — état de départ différent de la mesure', v_config;
  END IF;
END
$precheck$;

-- -----------------------------------------------------------------------------
-- §1 — ÉPINGLAGE
-- -----------------------------------------------------------------------------
ALTER FUNCTION public.mark_order_paid_atomic(text, text) SET search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- §2 — POST-CONDITIONS FAIL-CLOSED
-- -----------------------------------------------------------------------------
-- proconfig porte exactement la valeur visée ; corps, propriétaire, SECURITY
-- DEFINER et droits EXECUTE sont inchangés ; plus aucune fonction de public
-- (hors extensions) n'a de search_path mutable.
DO $postcheck$
DECLARE
  v_oid oid := 'public.mark_order_paid_atomic(text, text)'::regprocedure;
  v_n   int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.oid = v_oid
       AND p.prosecdef
       AND pg_get_userbyid(p.proowner) = 'postgres'
       AND md5(p.prosrc) = 'e1501c95b02ce13f76123373f9ab2bf5'
       AND p.proconfig = ARRAY['search_path=public, pg_temp']
  ) THEN
    RAISE EXCEPTION 'ABORT: état de la fonction inattendu après ALTER';
  END IF;

  IF has_function_privilege('anon', v_oid, 'EXECUTE')
     OR has_function_privilege('authenticated', v_oid, 'EXECUTE')
     OR NOT has_function_privilege('service_role', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'ABORT: droits EXECUTE inattendus (attendu : service_role seul côté API)';
  END IF;

  SELECT count(*) INTO v_n
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.prokind IN ('f', 'p')
     AND NOT EXISTS (SELECT 1 FROM pg_depend d
                      WHERE d.classid = 'pg_proc'::regclass
                        AND d.objid = p.oid AND d.deptype = 'e')
     AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}'::text[])) c
                      WHERE c LIKE 'search_path=%');
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'ABORT: % fonction(s) de public encore sans search_path épinglé', v_n;
  END IF;
END
$postcheck$;

-- =============================================================================
-- Vérification post-migration (lecture seule, à jouer après apply)
-- =============================================================================
--   SELECT p.proconfig, md5(p.prosrc), p.proacl
--     FROM pg_proc p
--    WHERE p.oid = 'public.mark_order_paid_atomic(text, text)'::regprocedure;
--   -- attendu : {"search_path=public, pg_temp"} | e1501c95b02ce13f76123373f9ab2bf5
--   --           | {postgres=X/postgres,service_role=X/postgres}
--
--   -- advisor Supabase (get_advisors type security) :
--   -- function_search_path_mutable = 0 entrée.
-- =============================================================================
