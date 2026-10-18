-- =============================================================================
-- Fixture — environnement de 20261011_diag_capture_maintenance_schema.sql, sur un
-- PostgreSQL JETABLE.
--
-- Ne reproduit que ce que les migrations du dépôt ne portent pas. Trois passes
-- exclusives :
--   * sans variable, AVANT tout le reste : les rôles API Supabase et leurs
--     privilèges PAR DÉFAUT (ALL accordé à anon/authenticated sur toute table ou
--     séquence créée), service_role en BYPASSRLS ;
--   * avec `-v forme_reelle=1`, APRÈS 20260308_diagnostic_engine_mvp.sql (qui crée
--     __diag_system, __diag_symptom et __diag_cause) : les deux tables d'entretien
--     et les 5 colonnes de __diag_cause telles qu'elles existaient en base AVANT
--     toute capture, créées hors du dépôt. Elles sont construites SANS le texte de
--     la capture (séquences explicites, contraintes nommées posées par ALTER TABLE,
--     colonnes ajoutées une à une) : la post-condition doit accepter la forme du
--     catalogue, pas un texte ;
--   * avec `-v prealables=1`, une fois les tables d'entretien en place : les 6
--     lignes que 20260321_diagnostic_engine_10_systems.sql référence (liens 57-60)
--     sans qu'aucune migration du dépôt ne les crée — système 2, symptôme 8,
--     opérations 1, 2, 5 et 8, créés hors du dépôt le 2026-03-08. Identifiants,
--     slugs, libellés et rattachements relevés en base, en lecture seule, le
--     2026-10-11 ; les autres colonnes restent à leur défaut.
--
-- Ne cible JAMAIS une base réelle.
-- =============================================================================

-- 2e passe (-v forme_reelle=1) : objets d'entretien d'avant la capture.
\if :{?forme_reelle}
CREATE SEQUENCE public.__diag_maintenance_operation_id_seq AS integer;
CREATE TABLE public.__diag_maintenance_operation (
  id                  integer NOT NULL DEFAULT nextval('public.__diag_maintenance_operation_id_seq'::regclass),
  slug                text NOT NULL,
  system_id           integer NOT NULL,
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
ALTER SEQUENCE public.__diag_maintenance_operation_id_seq
  OWNED BY public.__diag_maintenance_operation.id;
ALTER TABLE public.__diag_maintenance_operation
  ADD CONSTRAINT __diag_maintenance_operation_pkey PRIMARY KEY (id),
  ADD CONSTRAINT __diag_maintenance_operation_slug_key UNIQUE (slug),
  ADD CONSTRAINT __diag_maintenance_operation_system_id_fkey
    FOREIGN KEY (system_id) REFERENCES public.__diag_system (id);
CREATE INDEX idx_diag_maint_op_system
  ON public.__diag_maintenance_operation (system_id) WHERE active = true;
COMMENT ON TABLE public.__diag_maintenance_operation IS
  'Operations entretien preventif. Recherche deleguee a /api/rag/search (pivot 2026-04-18).';

CREATE SEQUENCE public.__diag_maintenance_symptom_link_id_seq AS integer;
CREATE TABLE public.__diag_maintenance_symptom_link (
  id           integer NOT NULL DEFAULT nextval('public.__diag_maintenance_symptom_link_id_seq'::regclass),
  symptom_id   integer NOT NULL,
  operation_id integer NOT NULL,
  relevance    text DEFAULT 'related',
  active       boolean DEFAULT true,
  created_at   timestamptz DEFAULT now()
);
ALTER SEQUENCE public.__diag_maintenance_symptom_link_id_seq
  OWNED BY public.__diag_maintenance_symptom_link.id;
ALTER TABLE public.__diag_maintenance_symptom_link
  ADD CONSTRAINT __diag_maintenance_symptom_link_pkey PRIMARY KEY (id),
  ADD CONSTRAINT __diag_maintenance_symptom_link_symptom_id_operation_id_key
    UNIQUE (symptom_id, operation_id),
  ADD CONSTRAINT __diag_maintenance_symptom_link_symptom_id_fkey
    FOREIGN KEY (symptom_id) REFERENCES public.__diag_symptom (id),
  ADD CONSTRAINT __diag_maintenance_symptom_link_operation_id_fkey
    FOREIGN KEY (operation_id) REFERENCES public.__diag_maintenance_operation (id);
CREATE INDEX idx_diag_maint_link_symptom
  ON public.__diag_maintenance_symptom_link (symptom_id) WHERE active = true;

ALTER TABLE public.__diag_cause ADD COLUMN plausible_km_min integer;
ALTER TABLE public.__diag_cause ADD COLUMN plausible_km_max integer;
ALTER TABLE public.__diag_cause ADD COLUMN plausible_age_min integer;
ALTER TABLE public.__diag_cause ADD COLUMN plausible_age_max integer;
ALTER TABLE public.__diag_cause ADD COLUMN workshop_priority text DEFAULT 'recommended';
\elif :{?prealables}
-- 3e passe (-v prealables=1) : lignes hors dépôt référencées par 20260321.
INSERT INTO public.__diag_system (id, slug, label, display_order) VALUES
  (2, 'demarrage_charge', 'Démarrage et circuit de charge', 2);
INSERT INTO public.__diag_symptom (id, slug, system_id, label) VALUES
  (8, 'start_cranks_no_fire', 2, 'Le démarreur tourne mais le moteur ne part pas');
INSERT INTO public.__diag_maintenance_operation (id, slug, system_id, label) VALUES
  (1, 'brake_pads_replacement', 1, 'Remplacement plaquettes de frein'),
  (2, 'brake_disc_replacement', 1, 'Remplacement disques de frein'),
  (5, 'battery_replacement', 2, 'Remplacement batterie'),
  (8, 'glow_plug_replacement', 2, 'Remplacement bougies de préchauffage');
\else
-- 1re passe : rôles API et privilèges par défaut.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon')          THEN CREATE ROLE anon NOLOGIN;          END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role')  THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Défauts Supabase (fixture UNIQUEMENT — jamais dans une migration).
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
\endif
