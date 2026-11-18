-- Retour arrière de 20261118_est_vendable_definition_unique.sql
--
-- Supprime les trois fonctions de lecture créées par la migration. Aucune
-- table, aucun droit de table, aucune donnée ne sont touchés.
--
-- À lancer seulement APRÈS avoir remis SITEMAP_R2_SOURCE à sa valeur par défaut
-- (legacy) : get_sitemap_r2_types_vendables n'a qu'un appelant, le générateur
-- du sitemap gamme × véhicule en mode `vendable`. Sans cela, la génération
-- suivante s'arrête sur erreur, sans publier, et garde les fichiers précédents.
--
-- L'engine est forward-only : ce fichier se lance à la main.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $precheck$
BEGIN
  IF to_regprocedure('public.est_vendable(text, text, numeric, boolean)') IS NULL
     OR to_regprocedure('public.piece_est_vendable(integer)') IS NULL
     OR to_regprocedure('public.get_sitemap_r2_types_vendables(integer, integer, integer)') IS NULL
  THEN
    RAISE EXCEPTION 'ABORT: une des trois fonctions créées par 20261118_est_vendable_definition_unique.sql est absente';
  END IF;
END
$precheck$;

-- Ordre : les deux lecteurs d'abord, l'expression qu'ils appellent ensuite.
DROP FUNCTION public.get_sitemap_r2_types_vendables(integer, integer, integer);
DROP FUNCTION public.piece_est_vendable(integer);
DROP FUNCTION public.est_vendable(text, text, numeric, boolean);

DO $postcheck$
BEGIN
  IF to_regprocedure('public.est_vendable(text, text, numeric, boolean)') IS NOT NULL
     OR to_regprocedure('public.piece_est_vendable(integer)') IS NOT NULL
     OR to_regprocedure('public.get_sitemap_r2_types_vendables(integer, integer, integer)') IS NOT NULL
  THEN
    RAISE EXCEPTION 'ABORT: une fonction existe encore après retour';
  END IF;
END
$postcheck$;

COMMIT;
