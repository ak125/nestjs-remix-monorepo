-- Rollback: 20261001_get_r6_guide_link_snapshot_definer_rpc
-- Supprime public.get_r6_guide_link_snapshot(). Aucune table n'est touchée, ni à
-- l'aller ni au retour.
-- À lancer UNIQUEMENT après le retrait du code qui l'appelle
-- (R6GuideLinkPolicyService) : sinon le rendu des pages gamme R1 échoue partout,
-- PROD comprise.
-- L'engine est forward-only : ce fichier se lance à la main. La transaction
-- explicite borne les délais par SET LOCAL et rend pré-condition, retrait et
-- post-condition indivisibles.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Pré-condition : on ne retire que la fonction posée par la migration.
DO $precheck$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.oid = to_regprocedure('public.get_r6_guide_link_snapshot()')
       AND p.prosecdef
       AND pg_get_userbyid(p.proowner) = 'postgres'
  ) THEN
    RAISE EXCEPTION 'ABORT: public.get_r6_guide_link_snapshot() absente ou différente de la migration (non SECURITY DEFINER, ou propriétaire autre que postgres)';
  END IF;
END
$precheck$;

DROP FUNCTION public.get_r6_guide_link_snapshot();

DO $postcheck$
BEGIN
  IF to_regprocedure('public.get_r6_guide_link_snapshot()') IS NOT NULL THEN
    RAISE EXCEPTION 'ABORT: public.get_r6_guide_link_snapshot() existe encore après retour';
  END IF;
END
$postcheck$;

COMMIT;
