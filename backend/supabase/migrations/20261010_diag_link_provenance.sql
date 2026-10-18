-- =============================================================================
-- Migration : provenance WIKI des liens symptôme → cause du moteur de diagnostic
-- Date      : 2026-10-10
-- Severity  : LOW (additif : 3 tables neuves, 2 fonctions neuves ; aucune table
--             existante n'est modifiée, aucune ligne existante n'est écrite)
-- Scope     : public.__diag_projection_runs, public.__diag_projection_conflicts,
--             public.__diag_link_provenance, public.__diag_projection_apply(jsonb),
--             public.__diag_projection_record_failure(jsonb)
-- Refs      : ADR-035 D1, D2, D5, D7 (governance-vault) ; ADR-112 D2, mode
--             « rattacher » (une ligne de run et des conflits typés par exécution,
--             aucun saut silencieux, retrait sans suppression) et §Amendements
--             ADR-033 (`cause_slug`, `vehicle_scope`). Remplace la PR #1659.
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
-- Aucun lecteur ni écrivain dans ce dépôt au moment de la migration. L'écrivain
-- prévu (DiagnosticProjectionModule, ADR-035 D2) appellera les deux fonctions avec
-- le client service_role, derrière DIAGNOSTIC_PROJECTION_ENABLED, OFF par défaut
-- (ADR-035 D5). __diag_symptom_cause_link n'est que lu : re-vérification `active`
-- et verrou FOR SHARE le temps de la transaction d'un run.
--
-- Strategy
-- --------
-- Additive et idempotente (IF NOT EXISTS, CREATE OR REPLACE, politiques en bloc
-- DO, REVOKE / GRANT rejouables).
--
-- ADR-035 D7 est porté par la base, pas par une convention :
--   * « écrire __diag_link_provenance hors de __diag_projection_apply » : aucun
--     rôle API ne garde de droit d'écriture sur les 3 tables (service_role : SELECT
--     seul) ; les deux fonctions sont SECURITY DEFINER et sont les seules voies
--     d'écriture. EXECUTE réservé à service_role (ADR-035 D2) : les privilèges par
--     défaut Supabase l'accordent aussi à anon et authenticated, d'où les REVOKE.
--     Les privilèges par défaut couvrent aussi les séquences d'identité : révoquées.
--   * « projeter une relation dont une source n'est pas raw_proven » : CHECK
--     __diag_link_provenance_sources_raw_proven (chaque source porte
--     `raw_proven: true`, verdict du builder WIKI recopié tel quel, ADR-035 D2).
-- search_path des fonctions : pg_catalog puis pg_temp en dernier (patron de la
-- documentation PostgreSQL pour SECURITY DEFINER) ; public en est exclu, chaque
-- objet de public est qualifié.
--
-- Run en échec : __diag_projection_apply est atomique, une erreur annule tout.
-- L'écrivain enregistre alors l'échec par __diag_projection_record_failure, avec
-- la même clé `run_key`. La contrainte d'unicité sur run_key suffit à rendre
-- l'issue cohérente, sans second mécanisme :
--   * apply en vol après l'insertion de son run : l'enregistrement de l'échec
--     attend la fin de sa transaction ; validée, il rend `applied` sans rien
--     écrire (seule la réponse de l'apply s'était perdue) ; annulée, il écrit
--     `failed` ;
--   * apply encore en attente du verrou consultatif : l'échec est écrit d'abord,
--     puis l'apply est refusé sur la clé déjà connue ; rien n'est appliqué.
--
-- Timeouts explicites, jamais hérités du rôle (60 s pour `postgres`) : les clés
-- étrangères vers __diag_symptom_cause_link prennent un verrou SHARE ROW
-- EXCLUSIVE sur cette table (écritures bloquées, lectures du moteur libres), bref
-- puisque les tables créées sont vides.
--
-- Aucune exemption squawk : require-concurrent-index-creation ne se lève pas, les
-- deux index portant sur des tables créées dans ce même fichier ; link_id est en
-- bigint (prefer-bigint-over-int), la clé étrangère int8 → int4 vers
-- __diag_symptom_cause_link.id est admise (même famille d'opérateurs btree).
-- =============================================================================

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- ── 1. Runs ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.__diag_projection_runs (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_key         uuid NOT NULL,
  triggered_by    text NOT NULL CHECK (triggered_by IN ('repeatable', 'admin')),
  runtime_env     text NOT NULL,
  index_sha256    text,
  builder_version text,
  -- NULL = inconnu : run en échec avant la lecture de l'index.
  exported_count  bigint CHECK (exported_count >= 0),
  projected_count bigint NOT NULL DEFAULT 0 CHECK (projected_count >= 0),
  conflict_count  bigint NOT NULL DEFAULT 0 CHECK (conflict_count >= 0),
  retired_count   bigint NOT NULL DEFAULT 0 CHECK (retired_count >= 0),
  status          text NOT NULL CHECK (status IN ('applied', 'failed')),
  error           text,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  CONSTRAINT __diag_projection_runs_run_key_key UNIQUE (run_key),
  -- ADR-035 D1 : exported = projected + conflicts pour tout run appliqué.
  CONSTRAINT __diag_projection_runs_complete CHECK (
    status <> 'applied'
    OR (exported_count IS NOT NULL AND exported_count = projected_count + conflict_count)
  ),
  -- Un run appliqué dit toujours quel export il a appliqué.
  CONSTRAINT __diag_projection_runs_applied_identified CHECK (
    status <> 'applied' OR (index_sha256 IS NOT NULL AND builder_version IS NOT NULL)
  ),
  -- Une erreur si et seulement si le run est en échec.
  CONSTRAINT __diag_projection_runs_error_iff_failed CHECK (
    CASE status
      WHEN 'failed' THEN error IS NOT NULL AND btrim(error) <> ''
      ELSE error IS NULL
    END
  ),
  -- Un run en échec n'a rien écrit : sa transaction a été annulée.
  CONSTRAINT __diag_projection_runs_failed_wrote_nothing CHECK (
    status <> 'failed'
    OR (projected_count = 0 AND conflict_count = 0 AND retired_count = 0)
  )
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
  -- cause_slug_mismatch : le `cause_slug` de la fiche contredit la résolution du
  --   mode « rattacher » (ADR-112 §Amendements ADR-033 : la résolution est
  --   vérifiée contre le WIKI).
  -- vehicle_scope_unsupported : une relation bornée à un carburant ou une famille
  --   moteur ne documente pas un lien global ; la provenance n'a pas de colonne de
  --   portée (ADR-035 D1).
  reason         text NOT NULL CHECK (reason IN (
                   'schema_invalid', 'not_a_cause_relation', 'unknown_symptom',
                   'system_mismatch', 'no_matching_link', 'ambiguous_cause',
                   'duplicate_relation', 'source_not_raw_proven',
                   'cause_slug_mismatch', 'vehicle_scope_unsupported')),
  detail         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- INDEX: __diag_projection_conflicts_run_id_idx
-- Table: public.__diag_projection_conflicts (nouvelle, 0 ligne ; croît à chaque run)
-- Pattern: WHERE run_id = $1 (conflits d'un run) ; contrôle de la FK RESTRICT vers les runs
-- Gain attendu: Index Scan sur les conflits d'un run, au lieu d'un Seq Scan de tout l'historique
-- RPC concernees: __diag_projection_apply (écriture) ; lecture par le module de projection
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
  sources                   jsonb NOT NULL,
  first_run_id              bigint NOT NULL
                              REFERENCES public.__diag_projection_runs (id) ON DELETE RESTRICT,
  last_run_id               bigint NOT NULL
                              REFERENCES public.__diag_projection_runs (id) ON DELETE RESTRICT,
  projected_at              timestamptz NOT NULL DEFAULT now(),
  retired_at                timestamptz,
  retired_run_id            bigint
                              REFERENCES public.__diag_projection_runs (id) ON DELETE RESTRICT,
  CONSTRAINT __diag_link_provenance_retired_pair
    CHECK ((retired_at IS NULL) = (retired_run_id IS NULL)),
  -- ADR-035 D7 : tableau non vide, chaque source `raw_proven: true` (booléen JSON).
  -- CASE : PostgreSQL ne garantit pas l'ordre d'évaluation d'un AND, et
  -- jsonb_array_length lève une erreur sur ce qui n'est pas un tableau.
  CONSTRAINT __diag_link_provenance_sources_raw_proven CHECK (
    CASE
      WHEN jsonb_typeof(sources) = 'array'
        THEN jsonb_array_length(sources) > 0
         AND jsonb_array_length(
               jsonb_path_query_array(sources, '$[*] ? (@.raw_proven == true)')
             ) = jsonb_array_length(sources)
      ELSE false
    END
  )
);

-- Une seule ligne VIVANTE par couple (lien, fiche) ; l'historique retiré reste.
-- INDEX: __diag_link_provenance_live_uniq
-- Table: public.__diag_link_provenance (nouvelle, 0 ligne ; une ligne vivante par lien × fiche)
-- Pattern: ON CONFLICT (link_id, wiki_path) WHERE retired_at IS NULL (upsert d'un run)
-- Gain attendu: arbitre obligatoire de l'upsert (sans lui, l'ON CONFLICT est refusé) et unicité
-- RPC concernees: __diag_projection_apply
CREATE UNIQUE INDEX IF NOT EXISTS __diag_link_provenance_live_uniq
  ON public.__diag_link_provenance (link_id, wiki_path)
  WHERE retired_at IS NULL;

-- ── 4. Droits et RLS ────────────────────────────────────────────────────────
--
-- Lecture seule pour service_role, rien pour anon et authenticated ; RLS activée
-- avec une politique de lecture service_role (patron de
-- 20260422_enable_rls_diag_tables.sql, restreint à SELECT).

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    '__diag_projection_runs', '__diag_projection_conflicts', '__diag_link_provenance'
  ] LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated, service_role', v_table);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO service_role', v_table);
    EXECUTE format(
      'REVOKE ALL ON SEQUENCE %s FROM anon, authenticated, service_role',
      pg_get_serial_sequence(format('public.%I', v_table), 'id')
    );
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = v_table
        AND policyname = v_table || '_service_role_select'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS PERMISSIVE FOR SELECT TO service_role USING (true)',
        v_table || '_service_role_select', v_table
      );
    END IF;
  END LOOP;
END $$;

-- ── 5. Application atomique d'un run ────────────────────────────────────────
--
-- Une seule transaction : verrou consultatif (DEV:3000 et PROD partagent la base,
-- pas la file BullMQ) → run → re-vérification `active` sous FOR SHARE → upsert
-- des lignes vivantes → retrait des lignes non reprises par ce run → conflits →
-- assertion de complétude. Toute erreur annule l'ensemble : un run partiel est
-- impossible. Une `run_key` déjà connue est refusée (contrainte d'unicité).
--
-- Payload :
--   { run_key, triggered_by, runtime_env, index_sha256, builder_version,
--     exported_count, started_at?, projections: [ {link_id, wiki_path, gamme_slug,
--     wiki_commit, content_hash, relation_to_part, part_role, confidence,
--     source_policy, confidence_score_computed, reviewed, diagnostic_safe,
--     sources} ], conflicts: [ {wiki_path, gamme_slug, relation_index,
--     symptom_slug, system_slug, reason, detail?} ] }
-- Retour : { run_id, projected_count, conflict_count, retired_count }

CREATE OR REPLACE FUNCTION public.__diag_projection_apply(p_run jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_projected bigint;
  v_conflicts bigint;
  v_run_id    bigint;
  v_wanted    bigint;
  v_locked    bigint;
  v_upserted  bigint;
  v_retired   bigint;
  v_recorded  bigint;
BEGIN
  IF jsonb_typeof(p_run -> 'projections') IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_run -> 'conflicts') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION '__diag_projection_apply: projections et conflicts doivent être des tableaux'
      USING ERRCODE = '22023';
  END IF;
  IF p_run ->> 'run_key' IS NULL THEN
    RAISE EXCEPTION '__diag_projection_apply: run_key manquante' USING ERRCODE = '22023';
  END IF;
  v_projected := jsonb_array_length(p_run -> 'projections');
  v_conflicts := jsonb_array_length(p_run -> 'conflicts');

  PERFORM pg_advisory_xact_lock(hashtext('__diag_projection_apply'));

  -- Les CHECK de la table valident dès l'insertion, avec les comptes DÉCLARÉS par
  -- le payload : exported = projected + conflicts, export identifié.
  INSERT INTO public.__diag_projection_runs (
    run_key, triggered_by, runtime_env, index_sha256, builder_version,
    exported_count, projected_count, conflict_count, retired_count, status, started_at
  ) VALUES (
    (p_run ->> 'run_key')::uuid, p_run ->> 'triggered_by', p_run ->> 'runtime_env',
    p_run ->> 'index_sha256', p_run ->> 'builder_version',
    (p_run ->> 'exported_count')::bigint, v_projected, v_conflicts, 0, 'applied',
    coalesce((p_run ->> 'started_at')::timestamptz, now())
  )
  RETURNING id INTO v_run_id;

  -- Re-vérification : chaque lien à documenter est encore actif, et le reste
  -- jusqu'au COMMIT (FOR SHARE bloque sa désactivation concurrente).
  SELECT count(DISTINCT (p ->> 'link_id')::bigint) INTO v_wanted
  FROM jsonb_array_elements(p_run -> 'projections') AS p;

  PERFORM 1
  FROM public.__diag_symptom_cause_link AS l
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
  INSERT INTO public.__diag_link_provenance AS lp (
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
  UPDATE public.__diag_link_provenance
  SET retired_at = now(), retired_run_id = v_run_id
  WHERE retired_at IS NULL
    AND last_run_id <> v_run_id;
  GET DIAGNOSTICS v_retired = ROW_COUNT;

  INSERT INTO public.__diag_projection_conflicts (
    run_id, wiki_path, gamme_slug, relation_index, symptom_slug, system_slug, reason, detail
  )
  SELECT
    v_run_id, c ->> 'wiki_path', c ->> 'gamme_slug', (c ->> 'relation_index')::bigint,
    c ->> 'symptom_slug', c ->> 'system_slug', c ->> 'reason',
    coalesce(c -> 'detail', '{}'::jsonb)
  FROM jsonb_array_elements(p_run -> 'conflicts') AS c;
  GET DIAGNOSTICS v_recorded = ROW_COUNT;

  -- Garde défensive, inatteignable par construction aujourd'hui : la re-vérification
  -- sous verrou et le CHECK de complétude imposent déjà ces égalités. Elle reste pour
  -- échouer fermé si une édition future affaiblit l'une de ces deux gardes.
  IF v_upserted <> v_projected OR v_recorded <> v_conflicts THEN
    RAISE EXCEPTION '__diag_projection_apply: écrit % projection(s) / % conflit(s), déclaré % / %',
      v_upserted, v_recorded, v_projected, v_conflicts;
  END IF;

  UPDATE public.__diag_projection_runs
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

REVOKE ALL ON FUNCTION public.__diag_projection_apply(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.__diag_projection_apply(jsonb) TO service_role;

-- ── 6. Enregistrement d'un run en échec ─────────────────────────────────────
--
-- Appelée par l'écrivain après toute erreur d'un apply, avec la même run_key.
-- Si la run_key est déjà enregistrée, rien n'est écrit et l'issue connue est
-- rendue : `applied` signifie que l'apply a été validé et que seule sa réponse
-- s'est perdue. Sans verrou consultatif : l'insertion attend d'elle-même un run
-- de même clé non encore validé (voir l'en-tête, « Run en échec »).
--
-- Payload : { run_key, triggered_by, runtime_env, error, index_sha256?,
--             builder_version?, exported_count?, started_at? }
-- Retour  : { run_id, status }

CREATE OR REPLACE FUNCTION public.__diag_projection_record_failure(p_run jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_run_key uuid;
  v_run_id  bigint;
  v_status  text;
BEGIN
  IF p_run ->> 'run_key' IS NULL THEN
    RAISE EXCEPTION '__diag_projection_record_failure: run_key manquante' USING ERRCODE = '22023';
  END IF;
  v_run_key := (p_run ->> 'run_key')::uuid;

  INSERT INTO public.__diag_projection_runs (
    run_key, triggered_by, runtime_env, index_sha256, builder_version,
    exported_count, status, error, started_at, finished_at
  ) VALUES (
    v_run_key, p_run ->> 'triggered_by', p_run ->> 'runtime_env',
    p_run ->> 'index_sha256', p_run ->> 'builder_version',
    (p_run ->> 'exported_count')::bigint, 'failed', p_run ->> 'error',
    coalesce((p_run ->> 'started_at')::timestamptz, now()), now()
  )
  ON CONFLICT (run_key) DO NOTHING
  RETURNING id INTO v_run_id;

  IF v_run_id IS NOT NULL THEN
    v_status := 'failed';
  ELSE
    SELECT r.id, r.status INTO v_run_id, v_status
    FROM public.__diag_projection_runs AS r
    WHERE r.run_key = v_run_key;
  END IF;

  RETURN jsonb_build_object('run_id', v_run_id, 'status', v_status);
END;
$$;

REVOKE ALL ON FUNCTION public.__diag_projection_record_failure(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.__diag_projection_record_failure(jsonb) TO service_role;

-- ── 7. Commentaires ─────────────────────────────────────────────────────────

COMMENT ON TABLE public.__diag_projection_runs IS
  'ADR-035 D1 : un run de projection WIKI → DB (applied ou failed). Écrit uniquement '
  'par __diag_projection_apply et __diag_projection_record_failure.';
COMMENT ON COLUMN public.__diag_projection_runs.run_key IS
  'Clé du run fournie par l''écrivain : un apply rejoué est refusé, et '
  '__diag_projection_record_failure rend l''issue réelle d''une clé déjà enregistrée.';
COMMENT ON TABLE public.__diag_projection_conflicts IS
  'ADR-035 D1 : une relation exportée non projetée, avec sa raison bornée. Écrit '
  'uniquement par __diag_projection_apply.';
COMMENT ON TABLE public.__diag_link_provenance IS
  'ADR-035 D1 : une ligne par couple (lien symptôme → cause, fiche WIKI). Lien '
  'documenté ssi ligne vivante (retired_at IS NULL). Écrit uniquement par '
  '__diag_projection_apply (ADR-035 D7).';
COMMENT ON FUNCTION public.__diag_projection_apply(jsonb) IS
  'ADR-035 D2 : applique un run de projection en une transaction. Ne crée ni '
  'symptôme, ni cause, ni lien. EXECUTE réservé à service_role.';
COMMENT ON FUNCTION public.__diag_projection_record_failure(jsonb) IS
  'ADR-035 D2 / ADR-112 D2 : enregistre un run en échec, ou rend l''issue déjà '
  'connue de sa run_key. EXECUTE réservé à service_role.';
