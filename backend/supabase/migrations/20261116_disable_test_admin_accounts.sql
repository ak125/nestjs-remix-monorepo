-- =============================================================================
-- Migration : désactiver 4 comptes administrateurs de test encore actifs
-- Date      : 2026-11-16 (mandat AZ, décision 101 du pilotage)
-- Scope     : public.___config_admin, colonne cnfa_activ, 4 lignes désignées par
--             leur cnfa_id exact. Rien d'autre.
-- Forward-only. Ne réécrit AUCUNE migration historique.
-- =============================================================================
--
-- POURQUOI — relevé du 2026-11-16 17:36 UTC : la table compte 11 lignes, dont 10
-- actives. Quatre des comptes actifs sont des comptes de test, de niveau
-- administrateur, créés à la main en 2025 par des scripts ponctuels retirés du
-- dépôt depuis :
--   adm_legacy_1759608487802   login legacyadmin   niveau 9
--   admin-001                  login admin         niveau 9
--   adm_test_1759608417040     login testadmin     niveau 9
--   test_admin_1754406875320   login testadmin     niveau 8
-- Aucun fichier suivi du dépôt, aucun workflow et aucun secret GitHub ne porte
-- ces identifiants ni ces logins (inventaire dans la PR).
--
-- EFFET — une connexion avec l'un de ces comptes est refusée dès l'application :
-- auth_resolve_user (20260310_auth_unified_lookup.sql) ne renvoie qu'un compte
-- cnfa_activ = '1'.
--
-- CE QUE CETTE MIGRATION NE FAIT PAS :
--   * aucune ligne supprimée, aucun mot de passe, niveau ou login modifié ;
--   * une session déjà ouverte n'est pas fermée : la relecture de session
--     (CookieSerializer → findAdminById) ne lit pas cnfa_activ. Voir la PR ;
--   * les comptes staff-001, staff-002, staff-003 sont hors périmètre.
--
-- GARDES — la migration s'interrompt, sans rien écrire, si :
--   * l'un des 4 cnfa_id est absent, ne porte plus le login relevé, ou a un
--     cnfa_activ autre que '1' ou '0' ;
--   * le compte adm_superadmin_1753375556.651700 est absent ou inactif (trois
--     des 4 comptes visés comptent parmi les cinq comptes actifs de niveau 9) ;
--   * l'UPDATE touche plus de 4 lignes, une ligne hors des 4 cnfa_id, ou le
--     compte adm_superadmin_1753375556.651700 ;
--   * après l'écriture, ce compte n'est plus actif, le nombre de comptes actifs
--     hors des 4 a changé, ou l'un des 4 n'est pas à '0'.
--
-- IDEMPOTENT ET REJOUABLE : seules les lignes encore à '1' sont écrites. Rejouée,
-- la migration écrit 0 ligne et passe.
--
-- APPLICATION : par le moteur du dépôt uniquement (Actions → « 🗄️ Apply Supabase
-- migrations (manual) », dry_run puis confirm = APPLY, only_ids = cet
-- identifiant), après fusion sur main — jamais par un canal qui contourne
-- infra.schema_migrations. Le bloc $precheck$ se joue seul en lecture seule
-- avant la fusion.
--
-- ROLLBACK : 20261116_disable_test_admin_accounts.down.sql, à lancer à la main
-- sur décision de l'owner (le moteur est forward-only).
-- =============================================================================

-- Pas de BEGIN/COMMIT explicite : le moteur applique ce fichier dans une
-- transaction (.squawk.toml `assume_in_transaction = true`). L'UPDATE verrouille
-- au plus 4 lignes, aucune réécriture de table.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_temp;

-- §0 — PRÉ-CONDITIONS, en lecture seule (rejouables avant la fusion) : la base
-- doit encore être celle du relevé, sinon la décision est à reprendre.
DO $precheck$
DECLARE
  c_ids    CONSTANT text[] := ARRAY['adm_legacy_1759608487802', 'admin-001',
                                    'adm_test_1759608417040', 'test_admin_1754406875320'];
  c_logins CONSTANT text[] := ARRAY['legacyadmin', 'admin', 'testadmin', 'testadmin'];
  c_owner  CONSTANT text := 'adm_superadmin_1753375556.651700';
  v_bad    text;
  v_active bigint;
  v_owner  text;
BEGIN
  SELECT string_agg(e.id, ', ' ORDER BY e.id) INTO v_bad
    FROM unnest(c_ids, c_logins) AS e(id, login)
    LEFT JOIN public.___config_admin a ON a.cnfa_id = e.id
   WHERE a.cnfa_id IS NULL
      OR a.cnfa_login IS DISTINCT FROM e.login
      OR a.cnfa_activ IS NULL
      OR a.cnfa_activ NOT IN ('0', '1');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'ABORT: compte(s) % — absent, login différent du relevé ou cnfa_activ hors « 0 »/« 1 » : la base a changé depuis le relevé',
      v_bad;
  END IF;

  SELECT a.cnfa_activ INTO v_owner
    FROM public.___config_admin a
   WHERE a.cnfa_id = c_owner;
  IF NOT FOUND OR v_owner IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'ABORT: compte % absent ou inactif (cnfa_activ=%) — aucun compte de test n''est désactivé dans cet état',
      c_owner, v_owner;
  END IF;

  SELECT count(*) INTO v_active
    FROM public.___config_admin a
   WHERE a.cnfa_id = ANY (c_ids)
     AND a.cnfa_activ = '1';
  RAISE NOTICE 'pré-condition désactivation comptes de test : OK (% compte(s) encore actif(s) sur 4 ; 0 = rejeu)',
    v_active;
END
$precheck$;

-- §1 — ÉCRITURE ET POST-CONDITIONS, dans la même transaction : tout écart annule
-- l'écriture.
DO $disable$
DECLARE
  c_ids    CONSTANT text[] := ARRAY['adm_legacy_1759608487802', 'admin-001',
                                    'adm_test_1759608417040', 'test_admin_1754406875320'];
  c_owner  CONSTANT text := 'adm_superadmin_1753375556.651700';
  v_before  bigint;
  v_after   bigint;
  v_touched text[];
  v_off     bigint;
  v_owner   text;
BEGIN
  -- Comptes actifs hors des 4 : ce nombre ne doit pas bouger.
  SELECT count(*) INTO v_before
    FROM public.___config_admin a
   WHERE a.cnfa_id <> ALL (c_ids)
     AND a.cnfa_activ = '1';

  WITH upd AS (
    UPDATE public.___config_admin
       SET cnfa_activ = '0'
     WHERE cnfa_id IN ('adm_legacy_1759608487802', 'admin-001',
                       'adm_test_1759608417040', 'test_admin_1754406875320')
       AND cnfa_activ = '1'
    RETURNING cnfa_id
  )
  SELECT coalesce(array_agg(u.cnfa_id ORDER BY u.cnfa_id), ARRAY[]::text[]) INTO v_touched
    FROM upd u;                                    -- 4 lignes maintenant, 0 au rejeu

  IF cardinality(v_touched) > 4 THEN
    RAISE EXCEPTION 'ABORT: garde — % lignes écrites, 4 au plus attendues', cardinality(v_touched);
  END IF;
  IF c_owner = ANY (v_touched) THEN
    RAISE EXCEPTION 'ABORT: garde — le compte % a été écrit', c_owner;
  END IF;
  IF NOT (v_touched <@ c_ids) THEN
    RAISE EXCEPTION 'ABORT: garde — ligne(s) écrite(s) hors des 4 cnfa_id visés : %', v_touched;
  END IF;

  SELECT a.cnfa_activ INTO v_owner
    FROM public.___config_admin a
   WHERE a.cnfa_id = c_owner;
  IF NOT FOUND OR v_owner IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'ABORT: post-condition — compte % absent ou inactif (cnfa_activ=%)', c_owner, v_owner;
  END IF;

  SELECT count(*) INTO v_after
    FROM public.___config_admin a
   WHERE a.cnfa_id <> ALL (c_ids)
     AND a.cnfa_activ = '1';
  IF v_after <> v_before THEN
    RAISE EXCEPTION 'ABORT: post-condition — comptes actifs hors des 4 : % avant, % après', v_before, v_after;
  END IF;

  SELECT count(*) INTO v_off
    FROM public.___config_admin a
   WHERE a.cnfa_id = ANY (c_ids)
     AND a.cnfa_activ = '0';
  IF v_off <> 4 THEN
    RAISE EXCEPTION 'ABORT: post-condition — % / 4 compte(s) de test à cnfa_activ = « 0 »', v_off;
  END IF;

  RAISE NOTICE 'désactivation comptes de test : % compte(s) désactivé(s) maintenant (0 = rejeu), 4 / 4 inactifs, % compte(s) actif(s) restant(s), inchangé(s)',
    cardinality(v_touched), v_after;
END
$disable$;
