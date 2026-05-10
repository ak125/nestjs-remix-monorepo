-- Migration : wrapper canon mark_stale_with_followup_rebuild
--
-- INC-2026-007 — Étape 4 du plan
--
-- Cause secondaire du 503 (cf. INC-2026-007 root cause) :
--   Le 23/04, un script `catalog_gamme_dedup_20260423` a fait
--   `UPDATE __vehicle_page_cache SET stale=true WHERE ...` sur 28 252 rows
--   sans rien déclencher d'autre. Aucun cron ne rebuild les stale → état dégradé permanent
--   jusqu'à ce qu'un hit utilisateur force un rebuild on-miss synchrone (~2s = 503).
--
-- Solution canon : ce wrapper marque stale ET déclenche immédiatement le rebuild.
-- Tout script SEO/admin DOIT l'utiliser au lieu d'un UPDATE direct.
--
-- Mode async : si on doit invalider beaucoup (ex. 28k rows), p_rebuild_immediately=false
-- laisse le cron Étape 2 faire le rebuild en background, mais le marquage stale est tracé.

CREATE OR REPLACE FUNCTION public.mark_stale_with_followup_rebuild(
  p_type_ids INTEGER[],
  p_reason TEXT,
  p_rebuild_immediately BOOLEAN DEFAULT TRUE
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_marked  INTEGER;
  v_rebuilt INTEGER := 0;
  v_id      INTEGER;
BEGIN
  IF p_type_ids IS NULL OR array_length(p_type_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  IF COALESCE(trim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'INC-2026-007: p_reason must be a non-empty string explaining why the cache is invalidated';
  END IF;

  UPDATE public.__vehicle_page_cache
  SET stale = TRUE, stale_reason = p_reason
  WHERE type_id = ANY(p_type_ids);
  GET DIAGNOSTICS v_marked = ROW_COUNT;

  IF p_rebuild_immediately THEN
    FOREACH v_id IN ARRAY p_type_ids LOOP
      BEGIN
        PERFORM public.rebuild_vehicle_page_cache(v_id);
        v_rebuilt := v_rebuilt + 1;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'INC-2026-007: rebuild_vehicle_page_cache(%) failed in mark_stale: %',
          v_id, SQLERRM;
      END;
    END LOOP;
  END IF;

  RAISE NOTICE 'INC-2026-007: marked % rows stale (reason: %), rebuilt % synchronously',
    v_marked, p_reason, v_rebuilt;

  RETURN v_marked;
END;
$$;

COMMENT ON FUNCTION public.mark_stale_with_followup_rebuild(INTEGER[], TEXT, BOOLEAN) IS
  'INC-2026-007 Etape 4 CANONIQUE: tout script qui invalide des rows __vehicle_page_cache DOIT utiliser cette fonction au lieu d''un UPDATE direct. p_rebuild_immediately=false delegue au cron de l''Etape 2. Reason obligatoire pour la traceability.';
