-- Rollback: 20260930_pin_mark_order_paid_atomic_search_path
-- Retire l'attribut search_path de public.mark_order_paid_atomic(text, text) : la
-- fonction retrouve l'état mesuré avant la migration (proconfig NULL), avec le
-- search_path de l'appelant. Corps, propriétaire, SECURITY DEFINER et droits EXECUTE
-- ne sont pas touchés, ni à l'aller ni au retour.
-- L'engine est forward-only : ce fichier se lance à la main. ALTER FUNCTION n'écrit
-- qu'une ligne de pg_proc ; la transaction explicite borne les délais par SET LOCAL
-- et rend pré-condition, retour et post-condition indivisibles.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Pré-condition : on ne défait que l'état posé par la migration, sur le corps mesuré.
DO $precheck$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.oid = to_regprocedure('public.mark_order_paid_atomic(text, text)')
       AND md5(p.prosrc) = 'e1501c95b02ce13f76123373f9ab2bf5'
       AND p.proconfig = ARRAY['search_path=public, pg_temp']
  ) THEN
    RAISE EXCEPTION 'ABORT: état de départ inattendu (fonction absente, corps modifié, ou proconfig différent de la migration)';
  END IF;
END
$precheck$;

ALTER FUNCTION public.mark_order_paid_atomic(text, text) RESET search_path;

DO $postcheck$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.oid = 'public.mark_order_paid_atomic(text, text)'::regprocedure
       AND p.prosecdef
       AND pg_get_userbyid(p.proowner) = 'postgres'
       AND md5(p.prosrc) = 'e1501c95b02ce13f76123373f9ab2bf5'
       AND p.proconfig IS NULL
  ) THEN
    RAISE EXCEPTION 'ABORT: état de la fonction inattendu après RESET';
  END IF;
END
$postcheck$;

COMMIT;
