-- Retour arrière de 20261030_get_substitution_status_definer_read.sql
--
-- Supprime la fonction de statut de substitution. Aucune table, aucun droit de
-- table, aucune donnée ne sont touchés ; get_substitution_data reste en place.
--
-- À lancer seulement APRÈS le retrait du code qui l'appelle (revert de la PR de
-- code du service substitution) : sans cela, le contrôle 404/410 des pages
-- produit échoue en PROD comme en PREPROD (le service le traite en fail-open :
-- page rendue sans contrôle, erreur journalisée).
--
-- L'engine est forward-only : ce fichier se lance à la main.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $precheck$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.oid = to_regprocedure('public.get_substitution_status(text, integer)')
       AND p.prosecdef
       AND pg_get_userbyid(p.proowner) = 'postgres'
  ) THEN
    RAISE EXCEPTION 'ABORT: public.get_substitution_status(text, integer) absente ou différente de la version créée par 20261030_get_substitution_status_definer_read.sql';
  END IF;
END
$precheck$;

DROP FUNCTION public.get_substitution_status(text, integer);

DO $postcheck$
BEGIN
  IF to_regprocedure('public.get_substitution_status(text, integer)') IS NOT NULL THEN
    RAISE EXCEPTION 'ABORT: get_substitution_status existe encore après retour';
  END IF;
END
$postcheck$;

COMMIT;
