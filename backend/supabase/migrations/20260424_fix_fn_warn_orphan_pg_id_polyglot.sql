-- 2026-04-24: fn_warn_orphan_pg_id — fix plpgsql polyglot field access
-- ----------------------------------------------------------------------------
-- INCIDENT : la fonction déclenchée par 4 triggers (r1_gamme_slots,
-- gamme_purchase_guide, gamme_conseil, gamme) utilisait un CASE statique
-- sur NEW.xxx_pg_id. En plpgsql, les branches CASE non atteintes sont
-- validées au compile-time contre le type du NEW record (qui est typé
-- selon la table d'invocation). Résultat : INSERT sur __seo_r1_gamme_slots
-- échouait avec :
--
--   ERROR: record "new" has no field "sgpg_pg_id"
--
-- Symptôme observé : aucun R1 slot créé pour les nouvelles gammes depuis
-- l'activation du trigger. Bloquait pg=3859 kit-de-freins-arriere (session
-- 2026-04-24) et probablement toute gamme après le backfill initial.
--
-- FIX : remplacer le CASE static par to_jsonb(NEW) + COALESCE sur les 4
-- colonnes candidates. Accès dynamique → pas de type check compile-time.
--
-- Comportement inchangé :
--   - 4 triggers BEFORE INSERT sur les mêmes 4 tables
--   - warn (pas BLOCK) si pg_id n'existe pas dans pieces_gamme
--   - RETURN NEW toujours (observationnel, pas enforce)
--
-- Idempotent : CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.fn_warn_orphan_pg_id()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  pgid_str text;
  exists_in_pg boolean;
  rec_json jsonb;
BEGIN
  rec_json := to_jsonb(NEW);
  pgid_str := COALESCE(
    rec_json->>'r1s_pg_id',
    rec_json->>'sgpg_pg_id',
    rec_json->>'sgc_pg_id',
    rec_json->>'sg_pg_id'
  );
  IF pgid_str IS NULL THEN RETURN NEW; END IF;
  SELECT EXISTS (SELECT 1 FROM pieces_gamme pg WHERE pg.pg_id::text = pgid_str) INTO exists_in_pg;
  IF NOT exists_in_pg THEN
    RAISE WARNING 'orphan_pg_id: table=% pg_id=% has no matching pieces_gamme row', TG_TABLE_NAME, pgid_str;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_warn_orphan_pg_id() IS
  'Trigger function (BEFORE INSERT) that warns if pg_id has no matching pieces_gamme row. Uses to_jsonb(NEW) for dynamic field access — avoids plpgsql polyglot type-check errors when the same function is attached to multiple tables with different pg_id column names. Fix 2026-04-24.';


-- ─── INC-2 backfill : resync 61 rows __seo_r6_keyword_plan ──────────────
-- Contexte : certaines rows ont r6kp_pg_id désynchronisé de r6kp_pg_alias
-- (conséquence des merges gammes historiques — ex: 3942→817, deprecate 3333).
-- Canon : r6kp_pg_id doit toujours être cohérent avec pieces_gamme.pg_id
-- pour le r6kp_pg_alias donné.

UPDATE __seo_r6_keyword_plan r6
SET r6kp_pg_id = pg.pg_id::text
FROM pieces_gamme pg
WHERE pg.pg_alias = r6.r6kp_pg_alias
  AND r6.r6kp_pg_id::text IS DISTINCT FROM pg.pg_id::text;
