-- squawk-ignore-file prefer-identity
-- squawk-ignore-file prefer-bigint-over-int
-- squawk-ignore-file prefer-text-field
-- Justification des ignores (cf. §3 + .squawk.toml « per-file ignore for legitimate patterns ») :
-- la table __seo_type_vlevel est CAPTURÉE VERBATIM depuis la DB live (structure legacy
-- pré-existante : bigserial, pg_id integer, colonnes varchar). Les règles « prefer-* » visent
-- la conception de NOUVELLES tables ; ici changer serial→identity / int→bigint / varchar→text
-- ferait DIVERGER la migration de la table live et casserait le but (capture idempotente no-op).
-- ============================================================================
-- 20260605_vlevel_capture_db_only_functions
-- ----------------------------------------------------------------------------
-- BUT : VERSIONNER (rendre visibles au repo) les objets V-Level qui vivaient
-- UNIQUEMENT dans la DB live — cause racine de l'échec du port LLM antérieur
-- (un port repo-only ne pouvait pas voir ces fonctions).
--
-- Source : capturé VERBATIM depuis la DB live `cxpojprgwgubzjyqzmoq`
--          via `pg_get_functiondef(...)` le 2026-06-05.
--
-- ⚠️  STATUT : PRÉPARÉE — application = OWNER (owner-gated, potentiellement DB-impacting).
--     CE N'EST PAS un no-op trivial : `CREATE OR REPLACE` est une mutation DB à
--     l'application. Acceptable UNIQUEMENT si, AVANT d'appliquer, le diff
--     `pg_get_functiondef('<fn>'::regproc)` live ↔ corps ci-dessous est
--     STRICTEMENT identique (schema, signature, RETURNS, volatility, SECURITY,
--     search_path). Sinon : STOP, ne pas appliquer.
--
-- Ces objets PRÉ-EXISTENT en live. Le but est documentaire/anti-dérive :
-- toute divergence future DB↔repo échouera en review au lieu de muter en silence.
-- Le `.down.sql` est volontairement NON destructif (ne DROP pas des objets live).
-- ============================================================================

-- require-timeout-settings (squawk) : bornes pour les ALTER/CREATE TRIGGER ci-dessous
-- (locks brefs sur une petite table, mais on borne par hygiène). Transaction-scoped.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- ----------------------------------------------------------------------------
-- 1) propagate_vlevel_per_typeid(p_pg_id)
--    Backfill des v_level NULL d'un type_id avec le meilleur niveau du véhicule
--    (V2>V3>V4>V5) ; PRÉSERVE tout v_level déjà assigné (non destructif).
--    NB : ce comportement DIVERGE du commentaire trompeur dans
--    scripts/insert-missing-keywords.ts:1037-1039 (Dette : corriger le commentaire).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.propagate_vlevel_per_typeid(p_pg_id bigint)
 RETURNS TABLE(updated bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  WITH best_vlevel AS (
    SELECT sk.type_id,
      CASE MIN(CASE sk.v_level
        WHEN 'V2' THEN 1 WHEN 'V3' THEN 2 WHEN 'V4' THEN 3 WHEN 'V5' THEN 4 ELSE 99 END)
        WHEN 1 THEN 'V2' WHEN 2 THEN 'V3' WHEN 3 THEN 'V4' WHEN 4 THEN 'V5'
      END as best_v
    FROM __seo_keywords sk
    WHERE sk.pg_id = p_pg_id AND sk.type_id IS NOT NULL AND sk.v_level IS NOT NULL
    GROUP BY sk.type_id
  ),
  targets AS (
    SELECT k.id,
      CASE
        WHEN k.v_level IS NOT NULL THEN k.v_level  -- preserver tout v_level deja assigne
        ELSE b.best_v                                -- seuls les NULL recoivent le meilleur du type_id
      END as target_v,
      k.v_level as current_v
    FROM __seo_keywords k
    JOIN best_vlevel b ON k.type_id = b.type_id
    WHERE k.pg_id = p_pg_id
  ),
  do_update AS (
    UPDATE __seo_keywords k
    SET v_level = t.target_v
    FROM targets t
    WHERE k.id = t.id AND k.v_level IS DISTINCT FROM t.target_v
    RETURNING k.id
  )
  SELECT COUNT(*)::bigint AS updated FROM do_update;
END;
$function$;

-- ----------------------------------------------------------------------------
-- 2) validate_vlevel_integrity()  (fonction du trigger trg_vlevel_integrity)
--    Encode une hiérarchie V1>V2>V3>V4>V5 + unicité par gamme.
--    ⚠️ Le trigger est DISABLED en live (tgenabled=D) — on le recrée DISABLED
--    pour fidélité. NE PAS réactiver sans avoir vérifié sa cohérence avec
--    l'intention V5=union (sa RÈGLE 3 pourrait bloquer des UPDATE de masse).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_vlevel_integrity()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_existing_level TEXT;
  v_existing_pg_id INT;
  v_priority_new INT;
  v_priority_existing INT;
BEGIN
  -- Ignorer si pas de type_id ou pas de v_level
  IF NEW.type_id IS NULL OR NEW.v_level IS NULL THEN
    RETURN NEW;
  END IF;

  v_priority_new := CASE NEW.v_level
    WHEN 'V1' THEN 1
    WHEN 'V2' THEN 2
    WHEN 'V3' THEN 3
    WHEN 'V4' THEN 4
    WHEN 'V5' THEN 5
    ELSE 99
  END;

  -- RÈGLE 1: Vérifier si ce type_id est déjà V1 (bloque TOUT sauf V1)
  SELECT v_level, pg_id INTO v_existing_level, v_existing_pg_id
  FROM __seo_keywords
  WHERE type_id = NEW.type_id
    AND v_level = 'V1'
    AND id != COALESCE(NEW.id, -1)
  LIMIT 1;

  IF v_existing_level = 'V1' AND NEW.v_level != 'V1' THEN
    RAISE EXCEPTION 'V-Level integrity violation: type_id % is V1 (inter-gammes) - cannot add to % in any gamme',
      NEW.type_id, NEW.v_level;
  END IF;

  -- RÈGLE 2: Si on veut créer un V1, vérifier qu'il n'existe pas en V3/V4/V5
  -- (V2 est OK car c'est la source de promotion)
  IF NEW.v_level = 'V1' THEN
    SELECT v_level, pg_id INTO v_existing_level, v_existing_pg_id
    FROM __seo_keywords
    WHERE type_id = NEW.type_id
      AND v_level NOT IN ('V1', 'V2')  -- V2 est permis (source de promotion)
      AND id != COALESCE(NEW.id, -1)
    LIMIT 1;

    IF v_existing_level IS NOT NULL THEN
      RAISE EXCEPTION 'V-Level integrity violation: type_id % already exists as % in pg_id=% - cannot promote to V1',
        NEW.type_id, v_existing_level, v_existing_pg_id;
    END IF;
    RETURN NEW;
  END IF;

  -- RÈGLE 3: Pour V2/V3/V4/V5, vérifier dans la MÊME gamme uniquement
  SELECT v_level INTO v_existing_level
  FROM __seo_keywords
  WHERE type_id = NEW.type_id
    AND v_level IS NOT NULL
    AND id != COALESCE(NEW.id, -1)
    AND pg_id = NEW.pg_id
  ORDER BY
    CASE v_level
      WHEN 'V1' THEN 1
      WHEN 'V2' THEN 2
      WHEN 'V3' THEN 3
      WHEN 'V4' THEN 4
      WHEN 'V5' THEN 5
    END
  LIMIT 1;

  IF v_existing_level IS NOT NULL THEN
    v_priority_existing := CASE v_existing_level
      WHEN 'V1' THEN 1
      WHEN 'V2' THEN 2
      WHEN 'V3' THEN 3
      WHEN 'V4' THEN 4
      WHEN 'V5' THEN 5
      ELSE 99
    END;

    IF v_priority_new > v_priority_existing THEN
      RAISE EXCEPTION 'V-Level integrity violation: type_id % already exists in % (cannot add to %) for pg_id=%',
        NEW.type_id, v_existing_level, NEW.v_level, NEW.pg_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Recrée le trigger en conservant son état LIVE = DISABLED.
-- (CREATE OR REPLACE TRIGGER requiert PG14+ ; Supabase est PG17.)
CREATE OR REPLACE TRIGGER trg_vlevel_integrity
  BEFORE INSERT OR UPDATE ON public.__seo_keywords
  FOR EACH ROW EXECUTE FUNCTION public.validate_vlevel_integrity();
ALTER TABLE public.__seo_keywords DISABLE TRIGGER trg_vlevel_integrity;

-- ----------------------------------------------------------------------------
-- 3) __seo_type_vlevel — table de PROJECTION (peuplée par rebuild-type-vlevel.py)
--    Capture VERBATIM des colonnes observées en live (structure legacy : voir les
--    ignores squawk en tête de fichier). La DB live reste autoritaire pour
--    index/contraintes non reproduits ici.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.__seo_type_vlevel (
  id          bigserial PRIMARY KEY,
  pg_id       integer            NOT NULL,
  type_id     bigint             NOT NULL,
  v_level     character varying  NOT NULL,
  source      character varying,
  model       character varying,
  energy      character varying,
  confidence  numeric,
  updated_at  timestamptz DEFAULT now()
);

COMMENT ON FUNCTION public.propagate_vlevel_per_typeid(bigint) IS
  'Backfill v_level NULL par type_id (meilleur niveau, préserve l''existant). Versionné 2026-06-05 (était DB-only). Réf doctrine: audit/levels-doctrine-cgc-vs-vlevel-2026-06-04.md';
