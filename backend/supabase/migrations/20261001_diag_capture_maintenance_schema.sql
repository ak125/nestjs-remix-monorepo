-- squawk-ignore-file prefer-identity
-- squawk-ignore-file prefer-bigint-over-int
-- Justification des ignores (guardrails passe 5 : règle lancée SANS exemption, squawk 2.52.1,
-- .squawk.toml du repo, le 2026-10-01) : 18 constats, tous sur les colonnes capturées —
-- 2 × prefer-identity (« Serial types make schema, dependency, and permission management
-- difficult ») sur les deux `id serial`, 16 × prefer-bigint-over-int (« Using 32-bit integer
-- fields can result in hitting the max `int` limit ») sur les colonnes integer. Aucune autre
-- règle ne lève. Ces règles visent la conception de NOUVELLES tables ; ici les objets existent
-- déjà en live en serial/integer (30 et 75 lignes). Écrire identity/bigint ferait diverger la
-- capture de la base : la post-condition (§4) échouerait sur toute base créée par ce fichier.
-- Changer le type des colonnes live serait un ALTER distinct, hors de cette capture.
-- =============================================================================
-- Migration : versionner le schéma des tables d'entretien du moteur de diagnostic
-- Date      : 2026-10-01
-- Scope     : 2 tables et 5 colonnes qui existent en base live sans CREATE ni
--             ADD COLUMN dans le repo. AUCUNE donnée lue ni écrite, aucun droit
--             modifié, aucune politique RLS touchée.
-- Forward-only. Ne réécrit AUCUNE migration historique.
-- Application : GO nominatif de l'owner (base partagée DEV / PREPROD / PROD).
-- =============================================================================
--
-- MESURE (lecture seule, 2026-10-01)
-- ----------------------------------
-- 13 tables `__diag*` en base live ; 7 n'ont aucun CREATE dans ce répertoire.
-- Deux sont lues par le code du module diagnostic-engine (data-service, moteur
-- maintenance-intelligence, calculateur d'entretien) :
--   * __diag_maintenance_operation     (30 lignes)
--   * __diag_maintenance_symptom_link  (75 lignes)
-- 20260321_diagnostic_engine_10_systems.sql y INSÈRE déjà les lignes de référence
-- et 20260422_enable_rls_diag_tables.sql y active déjà la RLS : les données et les
-- droits sont versionnés, pas le schéma. S'y ajoutent 5 colonnes de __diag_cause
-- sans ADD COLUMN au repo (plausible_km_min/max, plausible_age_min/max,
-- workshop_priority), lues par le moteur.
-- Les 5 autres tables sans CREATE ne sont lues par aucun code : elles ne sont PAS
-- capturées ici (les versionner ferait passer un schéma mort pour vivant). Les
-- conserver ou les supprimer relève de l'owner.
--
-- CAPTURE
-- -------
-- DDL relevé dans le catalogue live (pg_attribute, pg_attrdef, pg_constraint,
-- pg_index, pg_sequence, descriptions), recopié tel quel :
--   * `serial` = séquence integer possédée par la colonne (start 1, increment 1,
--     max 2147483647, cache 1, sans cycle), exactement l'objet live ;
--   * contraintes déclarées en ligne : PostgreSQL leur donne ses noms par défaut,
--     qui sont ceux de la base live (…_pkey, …_slug_key, …_system_id_fkey, …) ;
--   * ordre des colonnes = ordre live (attnum).
-- RLS, REVOKE et politiques ne sont PAS répétés : 20260422 les porte déjà.
--
-- DATE
-- ----
-- Datée du jour de la capture, jamais antidatée : le moteur applique toute
-- migration locale absente du ledger, sans refuser une date antérieure à une
-- version déjà appliquée, et un rejeu depuis une base vide est impossible par
-- construction (des tables legacy n'ont pas de CREATE au repo). Antidater ne
-- ferait que mal dater la capture.
--
-- EFFET ATTENDU EN LIVE : aucun changement de schéma. Chaque instruction est
-- IF NOT EXISTS (COMMENT ON réécrit le texte identique), puis la post-condition
-- compare la forme réelle (colonnes, défauts, contraintes, index, séquences,
-- commentaires) à la forme capturée et lève une exception à la moindre
-- différence : une base qui a dérivé depuis la capture fait échouer l'application
-- (transaction annulée) au lieu d'enregistrer comme appliquée une capture fausse.
-- =============================================================================

-- Le moteur enveloppe le fichier dans une transaction (.squawk.toml
-- `assume_in_transaction = true`) : SET LOCAL borne les verrous de cette
-- transaction seulement. Verrous brefs sur trois petites tables.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- -----------------------------------------------------------------------------
-- 1) __diag_maintenance_operation — opérations d'entretien préventif
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.__diag_maintenance_operation (
  id                  serial PRIMARY KEY,
  slug                text NOT NULL UNIQUE,
  system_id           integer NOT NULL REFERENCES public.__diag_system (id),
  label               text NOT NULL,
  description         text,
  interval_km_min     integer,
  interval_km_max     integer,
  interval_months_min integer,
  interval_months_max integer,
  severity_if_overdue text DEFAULT 'moderate',
  normal_wear_km_min  integer,
  normal_wear_km_max  integer,
  related_gamme_slug  text,
  related_pg_id       integer,
  active              boolean DEFAULT true,
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diag_maint_op_system
  ON public.__diag_maintenance_operation USING btree (system_id)
  WHERE (active = true);

COMMENT ON TABLE public.__diag_maintenance_operation IS
  'Operations entretien preventif. Recherche deleguee a /api/rag/search (pivot 2026-04-18).';

-- -----------------------------------------------------------------------------
-- 2) __diag_maintenance_symptom_link — symptôme ↔ opération d'entretien
--    (après la table 1 : clé étrangère operation_id)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.__diag_maintenance_symptom_link (
  id           serial PRIMARY KEY,
  symptom_id   integer NOT NULL REFERENCES public.__diag_symptom (id),
  operation_id integer NOT NULL REFERENCES public.__diag_maintenance_operation (id),
  relevance    text DEFAULT 'related',
  active       boolean DEFAULT true,
  created_at   timestamptz DEFAULT now(),
  UNIQUE (symptom_id, operation_id)
);

CREATE INDEX IF NOT EXISTS idx_diag_maint_link_symptom
  ON public.__diag_maintenance_symptom_link USING btree (symptom_id)
  WHERE (active = true);

-- -----------------------------------------------------------------------------
-- 3) __diag_cause — 5 colonnes ajoutées en live hors migration
-- -----------------------------------------------------------------------------
ALTER TABLE public.__diag_cause
  ADD COLUMN IF NOT EXISTS plausible_km_min  integer,
  ADD COLUMN IF NOT EXISTS plausible_km_max  integer,
  ADD COLUMN IF NOT EXISTS plausible_age_min integer,
  ADD COLUMN IF NOT EXISTS plausible_age_max integer,
  ADD COLUMN IF NOT EXISTS workshop_priority text DEFAULT 'recommended';

-- -----------------------------------------------------------------------------
-- 4) Post-condition : forme réelle == forme capturée, sinon la transaction échoue.
--    Le rendu du catalogue (pg_get_expr, pg_get_constraintdef, regclass) dépend
--    du search_path : il est fixé pendant la mesure puis restauré. Le tri est en
--    collation "C" pour ne pas dépendre de la locale de la base.
-- -----------------------------------------------------------------------------
DO $postcheck$
DECLARE
  v_search_path text := current_setting('search_path');
  v_actual      text;
  -- Forme live relevée le 2026-10-01 par cette même requête (lecture seule),
  -- une ligne par objet, triée en collation "C".
  v_expected    constant text := btrim($expected$
column __diag_cause.plausible_age_max integer
column __diag_cause.plausible_age_min integer
column __diag_cause.plausible_km_max integer
column __diag_cause.plausible_km_min integer
column __diag_cause.workshop_priority text default 'recommended'::text
column __diag_maintenance_operation.active boolean default true
column __diag_maintenance_operation.created_at timestamp with time zone default now()
column __diag_maintenance_operation.description text
column __diag_maintenance_operation.id integer not null default nextval('__diag_maintenance_operation_id_seq'::regclass)
column __diag_maintenance_operation.interval_km_max integer
column __diag_maintenance_operation.interval_km_min integer
column __diag_maintenance_operation.interval_months_max integer
column __diag_maintenance_operation.interval_months_min integer
column __diag_maintenance_operation.label text not null
column __diag_maintenance_operation.normal_wear_km_max integer
column __diag_maintenance_operation.normal_wear_km_min integer
column __diag_maintenance_operation.related_gamme_slug text
column __diag_maintenance_operation.related_pg_id integer
column __diag_maintenance_operation.severity_if_overdue text default 'moderate'::text
column __diag_maintenance_operation.slug text not null
column __diag_maintenance_operation.system_id integer not null
column __diag_maintenance_symptom_link.active boolean default true
column __diag_maintenance_symptom_link.created_at timestamp with time zone default now()
column __diag_maintenance_symptom_link.id integer not null default nextval('__diag_maintenance_symptom_link_id_seq'::regclass)
column __diag_maintenance_symptom_link.operation_id integer not null
column __diag_maintenance_symptom_link.relevance text default 'related'::text
column __diag_maintenance_symptom_link.symptom_id integer not null
comment __diag_maintenance_operation Operations entretien preventif. Recherche deleguee a /api/rag/search (pivot 2026-04-18).
comment __diag_maintenance_symptom_link -
constraint __diag_maintenance_operation.__diag_maintenance_operation_pkey PRIMARY KEY (id)
constraint __diag_maintenance_operation.__diag_maintenance_operation_slug_key UNIQUE (slug)
constraint __diag_maintenance_operation.__diag_maintenance_operation_system_id_fkey FOREIGN KEY (system_id) REFERENCES __diag_system(id)
constraint __diag_maintenance_symptom_link.__diag_maintenance_symptom_link_operation_id_fkey FOREIGN KEY (operation_id) REFERENCES __diag_maintenance_operation(id)
constraint __diag_maintenance_symptom_link.__diag_maintenance_symptom_link_pkey PRIMARY KEY (id)
constraint __diag_maintenance_symptom_link.__diag_maintenance_symptom_link_symptom_id_fkey FOREIGN KEY (symptom_id) REFERENCES __diag_symptom(id)
constraint __diag_maintenance_symptom_link.__diag_maintenance_symptom_link_symptom_id_operation_id_key UNIQUE (symptom_id, operation_id)
index CREATE INDEX idx_diag_maint_link_symptom ON public.__diag_maintenance_symptom_link USING btree (symptom_id) WHERE (active = true)
index CREATE INDEX idx_diag_maint_op_system ON public.__diag_maintenance_operation USING btree (system_id) WHERE (active = true)
index CREATE UNIQUE INDEX __diag_maintenance_operation_pkey ON public.__diag_maintenance_operation USING btree (id)
index CREATE UNIQUE INDEX __diag_maintenance_operation_slug_key ON public.__diag_maintenance_operation USING btree (slug)
index CREATE UNIQUE INDEX __diag_maintenance_symptom_link_pkey ON public.__diag_maintenance_symptom_link USING btree (id)
index CREATE UNIQUE INDEX __diag_maintenance_symptom_link_symptom_id_operation_id_key ON public.__diag_maintenance_symptom_link USING btree (symptom_id, operation_id)
sequence __diag_maintenance_operation_id_seq integer start 1 increment 1 max 2147483647 cache 1 cycle f
sequence __diag_maintenance_symptom_link_id_seq integer start 1 increment 1 max 2147483647 cache 1 cycle f
$expected$, E'\n');
BEGIN
  PERFORM set_config('search_path', 'pg_catalog, public', true);

  SELECT string_agg(shape.line, E'\n' ORDER BY shape.line COLLATE "C")
    INTO v_actual
    FROM (
      SELECT format('column %s.%s %s%s%s%s',
                    c.relname, a.attname, format_type(a.atttypid, a.atttypmod),
                    CASE WHEN a.attnotnull THEN ' not null' ELSE '' END,
                    coalesce(' default ' || pg_get_expr(d.adbin, d.adrelid), ''),
                    coalesce(' comment ' || col_description(a.attrelid, a.attnum), '')) AS line
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
       WHERE a.attnum > 0
         AND NOT a.attisdropped
         AND (a.attrelid IN ('public.__diag_maintenance_operation'::regclass,
                             'public.__diag_maintenance_symptom_link'::regclass)
              OR (a.attrelid = 'public.__diag_cause'::regclass
                  AND a.attname IN ('plausible_km_min', 'plausible_km_max',
                                    'plausible_age_min', 'plausible_age_max',
                                    'workshop_priority')))
      UNION ALL
      SELECT format('constraint %s.%s %s', c.relname, k.conname, pg_get_constraintdef(k.oid))
        FROM pg_constraint k
        JOIN pg_class c ON c.oid = k.conrelid
       WHERE k.conrelid IN ('public.__diag_maintenance_operation'::regclass,
                            'public.__diag_maintenance_symptom_link'::regclass)
      UNION ALL
      SELECT format('index %s', pg_get_indexdef(i.indexrelid))
        FROM pg_index i
       WHERE i.indrelid IN ('public.__diag_maintenance_operation'::regclass,
                            'public.__diag_maintenance_symptom_link'::regclass)
      UNION ALL
      SELECT format('sequence %s %s start %s increment %s max %s cache %s cycle %s',
                    s.seqrelid::regclass, format_type(s.seqtypid, NULL),
                    s.seqstart, s.seqincrement, s.seqmax, s.seqcache, s.seqcycle)
        FROM pg_sequence s
       WHERE s.seqrelid IN (
               pg_get_serial_sequence('public.__diag_maintenance_operation', 'id')::regclass,
               pg_get_serial_sequence('public.__diag_maintenance_symptom_link', 'id')::regclass)
      UNION ALL
      SELECT format('comment %s %s', c.relname, coalesce(obj_description(c.oid, 'pg_class'), '-'))
        FROM pg_class c
       WHERE c.oid IN ('public.__diag_maintenance_operation'::regclass,
                       'public.__diag_maintenance_symptom_link'::regclass)
    ) AS shape;

  PERFORM set_config('search_path', v_search_path, true);

  IF v_actual IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'capture __diag_maintenance_* divergente de la base : application annulée'
      USING DETAIL = format(E'attendu :\n%s\nréel :\n%s', v_expected, v_actual),
            HINT   = 'Re-mesurer le catalogue live et refaire la capture ; ne pas modifier la base pour la faire passer.';
  END IF;
END
$postcheck$;
