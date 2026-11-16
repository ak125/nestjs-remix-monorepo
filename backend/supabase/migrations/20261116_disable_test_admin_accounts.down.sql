-- Rollback: 20261116_disable_test_admin_accounts
-- Réactive les 4 comptes administrateurs de test (cnfa_activ = '1'), seulement
-- ceux qui sont encore à '0'. Aucune autre colonne, aucune autre ligne.
-- À ne lancer que sur décision de l'owner : ces comptes redeviennent utilisables
-- pour se connecter à l'administration, avec leur niveau (9, 9, 9, 8).
-- L'engine est forward-only : ce fichier se lance à la main. La transaction
-- explicite borne les délais par SET LOCAL et rend retour et constat
-- indivisibles.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_temp;

DO $reenable$
DECLARE
  v_n bigint;
BEGIN
  UPDATE public.___config_admin
     SET cnfa_activ = '1'
   WHERE cnfa_id IN ('adm_legacy_1759608487802', 'admin-001',
                     'adm_test_1759608417040', 'test_admin_1754406875320')
     AND cnfa_activ = '0';
  GET DIAGNOSTICS v_n = ROW_COUNT;

  IF v_n > 4 THEN
    RAISE EXCEPTION 'ABORT: % lignes écrites, 4 au plus attendues', v_n;
  END IF;
  RAISE NOTICE 'rollback désactivation comptes de test : % compte(s) réactivé(s) (0 = déjà actifs)', v_n;
END
$reenable$;

-- Constat : état des 4 comptes après retour (aucune donnée personnelle).
SELECT cnfa_id, cnfa_login, cnfa_level, cnfa_activ
  FROM public.___config_admin
 WHERE cnfa_id IN ('adm_legacy_1759608487802', 'admin-001',
                   'adm_test_1759608417040', 'test_admin_1754406875320')
 ORDER BY cnfa_id;

COMMIT;
