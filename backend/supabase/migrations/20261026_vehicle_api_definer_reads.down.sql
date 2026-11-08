-- Retour arrière de 20261026_vehicle_api_definer_reads.sql
--
-- Supprime les quatre fonctions de lecture de l'API véhicules. Aucune table,
-- aucun droit de table, aucune donnée ne sont touchés.
--
-- À lancer seulement APRÈS le retrait du code qui les appelle (revert de la PR de
-- code des services véhicules, et du service vehicle-models-rs s'il les lit) :
-- sans cela, les lectures du sélecteur échouent en PROD comme en PREPROD.
--
-- L'engine est forward-only : ce fichier se lance à la main.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $precheck$
DECLARE
  v_sig text;
BEGIN
  FOREACH v_sig IN ARRAY ARRAY[
    'public.get_vehicle_api_brands()',
    'public.get_vehicle_api_brand_models(smallint)',
    'public.get_vehicle_api_types_by_models(text[])',
    'public.get_vehicle_api_model_types(text)'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
       WHERE p.oid = to_regprocedure(v_sig)
         AND p.prosecdef
         AND pg_get_userbyid(p.proowner) = 'postgres'
    ) THEN
      RAISE EXCEPTION 'ABORT: % absente ou différente de la version créée par 20261026_vehicle_api_definer_reads.sql', v_sig;
    END IF;
  END LOOP;
END
$precheck$;

DROP FUNCTION public.get_vehicle_api_brands();
DROP FUNCTION public.get_vehicle_api_brand_models(smallint);
DROP FUNCTION public.get_vehicle_api_types_by_models(text[]);
DROP FUNCTION public.get_vehicle_api_model_types(text);

DO $postcheck$
BEGIN
  IF to_regprocedure('public.get_vehicle_api_brands()') IS NOT NULL
     OR to_regprocedure('public.get_vehicle_api_brand_models(smallint)') IS NOT NULL
     OR to_regprocedure('public.get_vehicle_api_types_by_models(text[])') IS NOT NULL
     OR to_regprocedure('public.get_vehicle_api_model_types(text)') IS NOT NULL THEN
    RAISE EXCEPTION 'ABORT: une fonction get_vehicle_api_* existe encore après retour';
  END IF;
END
$postcheck$;

COMMIT;
