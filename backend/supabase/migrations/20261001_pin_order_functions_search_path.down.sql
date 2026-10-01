-- Rollback: 20261001_pin_order_functions_search_path
-- Remet le search_path de create_order_atomic, append_order_event et
-- check_payment_tunnel_health à l'état mesuré avant la migration
-- ({search_path=public}). Corps, propriétaire, SECURITY DEFINER et droits EXECUTE
-- ne sont pas touchés, ni à l'aller ni au retour.
-- L'engine est forward-only : ce fichier se lance à la main. ALTER FUNCTION n'écrit
-- qu'une ligne de pg_proc ; la transaction explicite borne les délais par SET LOCAL
-- et rend pré-condition, retour et post-condition indivisibles.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Pré-condition : on ne défait que l'état posé par la migration, sur les corps mesurés.
DO $precheck$
DECLARE
  r record;
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
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
       WHERE p.oid = to_regprocedure(r.sig)
         AND md5(p.prosrc) = r.md5
         AND p.proconfig = ARRAY['search_path=public, pg_temp']
    ) THEN
      RAISE EXCEPTION 'ABORT: état de départ inattendu pour % (fonction absente, corps modifié, ou proconfig différent de la migration)', r.sig;
    END IF;
  END LOOP;
END
$precheck$;

ALTER FUNCTION public.create_order_atomic(jsonb, jsonb, uuid)
  SET search_path = public;
ALTER FUNCTION public.append_order_event(text, text, text, text, jsonb, text, uuid, bigint)
  SET search_path = public;
ALTER FUNCTION public.check_payment_tunnel_health(integer)
  SET search_path = public;

DO $postcheck$
DECLARE
  r record;
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
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
       WHERE p.oid = r.sig::regprocedure
         AND p.prosecdef
         AND pg_get_userbyid(p.proowner) = 'postgres'
         AND md5(p.prosrc) = r.md5
         AND p.proconfig = ARRAY['search_path=public']
    ) THEN
      RAISE EXCEPTION 'ABORT: état de % inattendu après retour', r.sig;
    END IF;
  END LOOP;
END
$postcheck$;

COMMIT;
