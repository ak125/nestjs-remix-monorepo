-- =============================================================================
-- Migration : provenance WIKI des liens symptôme → cause du moteur de diagnostic
-- Date      : 2026-10-01
-- Severity  : LOW (additif : 3 tables neuves, 1 fonction neuve ; aucune table
--             existante n'est modifiée, aucune ligne existante n'est écrite)
-- Scope     : public.__diag_projection_runs, public.__diag_projection_conflicts,
--             public.__diag_link_provenance, public.__diag_projection_apply(jsonb)
-- Spec      : docs/superpowers/specs/2026-09-30-diagnostic-wiki-provenance-design.md §4.4
-- =============================================================================
--
-- Tables couvertes
--
--   - public.__diag_projection_runs       un run de projection WIKI → DB (appliqué ou en échec)
--   - public.__diag_projection_conflicts  une relation exportée non projetée, avec sa raison
--   - public.__diag_link_provenance       une ligne par couple (lien symptôme → cause, fiche WIKI)
--
-- Risk before this migration
-- --------------------------
-- Les 162 liens de __diag_symptom_cause_link n'ont aucune origine traçable : rien
-- ne distingue un lien documenté par une fiche WIKI sourcée d'un lien saisi à la
-- main. Le moteur ne peut donc ni exposer ni pondérer une preuve.
--
-- Backend impact
-- --------------
-- Aucun lecteur existant. Seul écrivain : DiagnosticProjectionWriterService
-- (client service_role), via __diag_projection_apply pour un run appliqué et par
-- insertion directe dans __diag_projection_runs pour un run en échec. Drapeau
-- DIAGNOSTIC_PROJECTION_ENABLED, OFF par défaut : sans lui, aucune écriture.
-- __diag_symptom_cause_link n'est lu que pour la re-vérification `active` et
-- verrouillé en FOR SHARE le temps de la transaction d'un run.
--
-- Strategy
-- --------
-- Additive et idempotente (IF NOT EXISTS, CREATE OR REPLACE, politiques en bloc
-- DO). RLS activée + politique service_role, REVOKE anon/authenticated (patron de
-- 20260422_enable_rls_diag_tables.sql). EXECUTE de la fonction réservé à
-- service_role : les privilèges par défaut Supabase l'accordent à anon, d'où le
-- REVOKE explicite.
--
-- Timeouts explicites, jamais hérités du rôle (60 s pour `postgres`) : les clés
-- étrangères vers __diag_symptom_cause_link prennent un verrou SHARE ROW
-- EXCLUSIVE sur cette table (écritures bloquées, lectures du moteur libres), bref
-- puisque les tables créées sont vides.
--
-- Aucune exemption squawk. Vérifié avec squawk 2.52.1 (version de la CI) :
--   require-concurrent-index-creation ne se lève pas, les deux index portant sur
--   des tables créées dans ce même fichier ;
--   prefer-bigint-over-int se levait sur link_id (integer, le type de
--   __diag_symptom_cause_link.id) : la colonne est en bigint, la clé étrangère
--   int8 → int4 est admise (même famille d'opérateurs btree).
-- =============================================================================

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- ── 1. Runs ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.__diag_projection_runs (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  triggered_by    text NOT NULL CHECK (triggered_by IN ('repeatable', 'admin')),
  runtime_env     text NOT NULL,
  index_sha256    text,
  builder_version text,
  exported_count  bigint NOT NULL DEFAULT 0 CHECK (exported_count >= 0),
  projected_count bigint NOT NULL DEFAULT 0 CHECK (projected_count >= 0),
  conflict_count  bigint NOT NULL DEFAULT 0 CHECK (conflict_count >= 0),
  retired_count   bigint NOT NULL DEFAULT 0 CHECK (retired_count >= 0),
  status          text NOT NULL CHECK (status IN ('applied', 'failed')),
  error           text,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  CONSTRAINT __diag_projection_runs_complete
    CHECK (status <> 'applied' OR exported_count = projected_count + conflict_count),
  CONSTRAINT __diag_projection_runs_failed_has_error
    CHECK (status <> 'failed' OR error IS NOT NULL)
);

-- ── 2. Conflits ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.__diag_projection_conflicts (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id         bigint NOT NULL
                   REFERENCES public.__diag_projection_runs (id) ON DELETE RESTRICT,
  wiki_path      text NOT NULL,
  gamme_slug     text NOT NULL,
  relation_index bigint NOT NULL CHECK (relation_index >= 0),
  symptom_slug   text,
  system_slug    text,
  reason         text NOT NULL CHECK (reason IN (
                   'schema_invalid', 'not_a_cause_relation', 'unknown_symptom',
                   'system_mismatch', 'no_matching_link', 'ambiguous_cause',
                   'duplicate_relation', 'source_not_raw_proven')),
  detail         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS __diag_projection_conflicts_run_id_idx
  ON public.__diag_projection_conflicts (run_id);

-- ── 3. Provenance ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.__diag_link_provenance (
  id                        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  link_id                   bigint NOT NULL
                              REFERENCES public.__diag_symptom_cause_link (id) ON DELETE RESTRICT,
  wiki_path                 text NOT NULL,
  gamme_slug                text NOT NULL,
  wiki_commit               text NOT NULL,
  content_hash              text NOT NULL,
  relation_to_part          text NOT NULL,
  part_role                 text NOT NULL,
  confidence                text NOT NULL,
  source_policy             text NOT NULL,
  confidence_score_computed numeric NOT NULL,
  reviewed                  boolean NOT NULL,
  diagnostic_safe           boolean NOT NULL,
  sources                   jsonb NOT NULL
                              CHECK (jsonb_typeof(sources) = 'array' AND sources <> '[]'::jsonb),
  first_run_id              bigint NOT NULL
                              REFERENCES public.__diag_projection_runs (id) ON DELETE RESTRICT,
  last_run_id               bigint NOT NULL
                              REFERENCES public.__diag_projection_runs (id) ON DELETE RESTRICT,
  projected_at              timestamptz NOT NULL DEFAULT now(),
  retired_at                timestamptz,
  retired_run_id            bigint
                              REFERENCES public.__diag_projection_runs (id) ON DELETE RESTRICT,
  CONSTRAINT __diag_link_provenance_retired_pair
    CHECK ((retired_at IS NULL) = (retired_run_id IS NULL))
);

-- Une seule ligne VIVANTE par couple (lien, fiche) ; l'historique retiré reste.
CREATE UNIQUE INDEX IF NOT EXISTS __diag_link_provenance_live_uniq
  ON public.__diag_link_provenance (link_id, wiki_path)
  WHERE retired_at IS NULL;

-- ── 4. RLS (patron 20260422_enable_rls_diag_tables.sql) ─────────────────────

REVOKE ALL ON TABLE public.__diag_link_provenance FROM anon, authenticated;
ALTER TABLE public.__diag_link_provenance ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = '__diag_link_provenance'
      AND policyname = '__diag_link_provenance_service_role_all'
  ) THEN
    CREATE POLICY __diag_link_provenance_service_role_all ON public.__diag_link_provenance
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

REVOKE ALL ON TABLE public.__diag_projection_conflicts FROM anon, authenticated;
ALTER TABLE public.__diag_projection_conflicts ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = '__diag_projection_conflicts'
      AND policyname = '__diag_projection_conflicts_service_role_all'
  ) THEN
    CREATE POLICY __diag_projection_conflicts_service_role_all ON public.__diag_projection_conflicts
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

REVOKE ALL ON TABLE public.__diag_projection_runs FROM anon, authenticated;
ALTER TABLE public.__diag_projection_runs ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = '__diag_projection_runs'
      AND policyname = '__diag_projection_runs_service_role_all'
  ) THEN
    CREATE POLICY __diag_projection_runs_service_role_all ON public.__diag_projection_runs
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── 5. Application atomique d'un run ────────────────────────────────────────
--
-- Une seule transaction : verrou consultatif (DEV:3000 et PROD partagent la base,
-- pas la file BullMQ) → run → re-vérification `active` sous FOR SHARE → upsert
-- des lignes vivantes → retrait des lignes non reprises par ce run → conflits →
-- assertion de complétude. Toute erreur annule l'ensemble : un run partiel est
-- impossible. Le writer enregistre alors un run `failed` à part.
--
-- Payload :
--   { triggered_by, runtime_env, index_sha256, builder_version, exported_count,
--     started_at?, projections: [ {link_id, wiki_path, gamme_slug, wiki_commit,
--     content_hash, relation_to_part, part_role, confidence, source_policy,
--     confidence_score_computed, reviewed, diagnostic_safe, sources} ],
--     conflicts: [ {wiki_path, gamme_slug, relation_index, symptom_slug,
--     system_slug, reason, detail} ] }
-- Retour : { run_id, projected_count, conflict_count, retired_count }

CREATE OR REPLACE FUNCTION public.__diag_projection_apply(p_run jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_projected bigint := jsonb_array_length(p_run -> 'projections');
  v_conflicts bigint := jsonb_array_length(p_run -> 'conflicts');
  v_run_id    bigint;
  v_wanted    bigint;
  v_locked    bigint;
  v_upserted  bigint;
  v_retired   bigint;
  v_recorded  bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('__diag_projection_apply'));

  -- Le CHECK __diag_projection_runs_complete valide exported = projected + conflicts
  -- dès l'insertion, avec les comptes DÉCLARÉS par le payload.
  INSERT INTO __diag_projection_runs (
    triggered_by, runtime_env, index_sha256, builder_version,
    exported_count, projected_count, conflict_count, retired_count, status, started_at
  ) VALUES (
    p_run ->> 'triggered_by', p_run ->> 'runtime_env', p_run ->> 'index_sha256',
    p_run ->> 'builder_version', (p_run ->> 'exported_count')::bigint,
    v_projected, v_conflicts, 0, 'applied',
    coalesce((p_run ->> 'started_at')::timestamptz, now())
  )
  RETURNING id INTO v_run_id;

  -- Re-vérification : chaque lien à documenter est encore actif, et le reste
  -- jusqu'au COMMIT (FOR SHARE bloque sa désactivation concurrente).
  SELECT count(DISTINCT (p ->> 'link_id')::bigint) INTO v_wanted
  FROM jsonb_array_elements(p_run -> 'projections') AS p;

  PERFORM 1
  FROM __diag_symptom_cause_link AS l
  WHERE l.active IS TRUE
    AND l.id IN (
      SELECT (p ->> 'link_id')::bigint
      FROM jsonb_array_elements(p_run -> 'projections') AS p
    )
  FOR SHARE OF l;
  GET DIAGNOSTICS v_locked = ROW_COUNT;

  IF v_locked <> v_wanted THEN
    RAISE EXCEPTION '__diag_projection_apply: % lien(s) à projeter, % encore actif(s)',
      v_wanted, v_locked;
  END IF;

  -- Upsert des lignes vivantes. first_run_id et projected_at ne sont posés qu'à
  -- la création : ils datent la PREMIÈRE projection du couple (lien, fiche).
  INSERT INTO __diag_link_provenance AS lp (
    link_id, wiki_path, gamme_slug, wiki_commit, content_hash,
    relation_to_part, part_role, confidence, source_policy,
    confidence_score_computed, reviewed, diagnostic_safe, sources,
    first_run_id, last_run_id
  )
  SELECT
    (p ->> 'link_id')::bigint, p ->> 'wiki_path', p ->> 'gamme_slug',
    p ->> 'wiki_commit', p ->> 'content_hash',
    p ->> 'relation_to_part', p ->> 'part_role', p ->> 'confidence', p ->> 'source_policy',
    (p ->> 'confidence_score_computed')::numeric, (p ->> 'reviewed')::boolean,
    (p ->> 'diagnostic_safe')::boolean, p -> 'sources',
    v_run_id, v_run_id
  FROM jsonb_array_elements(p_run -> 'projections') AS p
  ON CONFLICT (link_id, wiki_path) WHERE retired_at IS NULL DO UPDATE SET
    gamme_slug                = EXCLUDED.gamme_slug,
    wiki_commit               = EXCLUDED.wiki_commit,
    content_hash              = EXCLUDED.content_hash,
    relation_to_part          = EXCLUDED.relation_to_part,
    part_role                 = EXCLUDED.part_role,
    confidence                = EXCLUDED.confidence,
    source_policy             = EXCLUDED.source_policy,
    confidence_score_computed = EXCLUDED.confidence_score_computed,
    reviewed                  = EXCLUDED.reviewed,
    diagnostic_safe           = EXCLUDED.diagnostic_safe,
    sources                   = EXCLUDED.sources,
    last_run_id               = EXCLUDED.last_run_id;
  GET DIAGNOSTICS v_upserted = ROW_COUNT;

  -- Retrait doux : toute ligne vivante que CE run n'a pas reprise.
  UPDATE __diag_link_provenance
  SET retired_at = now(), retired_run_id = v_run_id
  WHERE retired_at IS NULL
    AND last_run_id <> v_run_id;
  GET DIAGNOSTICS v_retired = ROW_COUNT;

  INSERT INTO __diag_projection_conflicts (
    run_id, wiki_path, gamme_slug, relation_index, symptom_slug, system_slug, reason, detail
  )
  SELECT
    v_run_id, c ->> 'wiki_path', c ->> 'gamme_slug', (c ->> 'relation_index')::bigint,
    c ->> 'symptom_slug', c ->> 'system_slug', c ->> 'reason',
    coalesce(c -> 'detail', '{}'::jsonb)
  FROM jsonb_array_elements(p_run -> 'conflicts') AS c;
  GET DIAGNOSTICS v_recorded = ROW_COUNT;

  IF v_upserted <> v_projected OR v_recorded <> v_conflicts THEN
    RAISE EXCEPTION '__diag_projection_apply: écrit % projection(s) / % conflit(s), déclaré % / %',
      v_upserted, v_recorded, v_projected, v_conflicts;
  END IF;

  UPDATE __diag_projection_runs
  SET retired_count = v_retired, finished_at = now()
  WHERE id = v_run_id;

  RETURN jsonb_build_object(
    'run_id', v_run_id,
    'projected_count', v_projected,
    'conflict_count', v_conflicts,
    'retired_count', v_retired
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.__diag_projection_apply(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.__diag_projection_apply(jsonb) TO service_role;
