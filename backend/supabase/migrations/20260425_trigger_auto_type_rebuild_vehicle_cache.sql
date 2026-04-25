-- Migration : trigger sur auto_type pour rebuild auto du cache véhicule
--
-- INC-2026-007 — Étape 3 du plan
--
-- Garantit que toute insertion/activation d'un type véhicule déclenche immédiatement
-- le rebuild de sa ligne `__vehicle_page_cache`. Élimine le rebuild on-miss synchrone
-- côté hit utilisateur, qui est la cause du 503 (cf. INC-2026-007).
--
-- Cas couverts :
--   1. INSERT auto_type avec type_display=1 → rebuild immédiat
--   2. UPDATE type_display 0→1 (activation d'un type existant) → rebuild immédiat
--
-- Cas NON couverts par ce trigger (gérés par les Étapes 2+4) :
--   - Données sources (pieces, pieces_relation_type) modifiées : marquage stale via
--     mark_stale_with_followup_rebuild() côté script de sync (Étape 4)
--   - Stale rows existantes : cron de l'Étape 2 les rattrape
--
-- Conforme ADR-016 ligne 224 : pas de trigger sur pieces_relation_type (368M rows,
-- dégraderait sync catalogue fournisseur).

CREATE OR REPLACE FUNCTION public.trg_auto_type_rebuild_cache()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_type_id_int INTEGER;
BEGIN
  -- auto_type.type_id est TEXT, on cast en INT pour rebuild_vehicle_page_cache
  v_type_id_int := NEW.type_id::INTEGER;

  -- Cas 1 : INSERT avec type_display=1
  -- Cas 2 : UPDATE type_display 0→1
  IF (TG_OP = 'INSERT' AND NEW.type_display::INT = 1)
     OR (TG_OP = 'UPDATE' AND COALESCE(OLD.type_display, '0')::INT = 0 AND NEW.type_display::INT = 1)
  THEN
    -- Best-effort : si rebuild échoue (vehicle pas trouvé, etc.), ne pas bloquer le INSERT
    BEGIN
      PERFORM public.rebuild_vehicle_page_cache(v_type_id_int);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'INC-2026-007: rebuild_vehicle_page_cache(%) failed in trigger: %',
        v_type_id_int, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_type_rebuild_cache ON public.auto_type;

CREATE TRIGGER trg_auto_type_rebuild_cache
AFTER INSERT OR UPDATE OF type_display ON public.auto_type
FOR EACH ROW EXECUTE FUNCTION public.trg_auto_type_rebuild_cache();

COMMENT ON FUNCTION public.trg_auto_type_rebuild_cache() IS
  'INC-2026-007 Etape 3: pre-rebuild __vehicle_page_cache des qu''un type est insere ou active. Garantit zero rebuild on-miss en steady state.';

COMMENT ON TRIGGER trg_auto_type_rebuild_cache ON public.auto_type IS
  'INC-2026-007: appelle rebuild_vehicle_page_cache(NEW.type_id) sur INSERT type_display=1 ou UPDATE display 0->1.';
