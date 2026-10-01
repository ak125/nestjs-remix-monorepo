-- =============================================================================
-- Fixture — surface du moteur de diagnostic nécessaire à
-- <AAAAMMJJ>_diag_link_provenance.sql, sur un PostgreSQL JETABLE.
--
-- Reproduit ce qui décide du comportement de la migration :
--   * les rôles API Supabase et leurs privilèges PAR DÉFAUT (EXECUTE et ALL
--     accordés à anon/authenticated sur tout objet créé) : c'est ce défaut que
--     la migration doit neutraliser par ses REVOKE ;
--   * service_role en BYPASSRLS, comme sur Supabase ;
--   * les 4 tables __diag_* lues par la RPC, avec les types de
--     20260308_diagnostic_engine_mvp.sql (SERIAL / INT, `active` nullable) ;
--   * les liens réels 113 / 114 / 117 et les deux causes voisines qui mappent
--     les mêmes gammes (filtre_carburant_injection, filtre_habitacle_clim).
--
-- Ne cible JAMAIS une base réelle.
-- =============================================================================

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

CREATE TABLE public.__diag_system (
  id SERIAL PRIMARY KEY, slug TEXT UNIQUE NOT NULL, label TEXT NOT NULL,
  description TEXT, display_order INT DEFAULT 0, active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE public.__diag_symptom (
  id SERIAL PRIMARY KEY, slug TEXT UNIQUE NOT NULL,
  system_id INT NOT NULL REFERENCES public.__diag_system(id), label TEXT NOT NULL,
  description TEXT, signal_mode TEXT NOT NULL DEFAULT 'symptom_slugs',
  urgency TEXT DEFAULT 'moyenne', active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE public.__diag_cause (
  id SERIAL PRIMARY KEY, slug TEXT UNIQUE NOT NULL,
  system_id INT NOT NULL REFERENCES public.__diag_system(id), label TEXT NOT NULL,
  cause_type TEXT NOT NULL DEFAULT 'maintenance_related', description TEXT,
  verification_method TEXT, urgency TEXT DEFAULT 'moyenne', active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE public.__diag_symptom_cause_link (
  id SERIAL PRIMARY KEY,
  symptom_id INT NOT NULL REFERENCES public.__diag_symptom(id),
  cause_id INT NOT NULL REFERENCES public.__diag_cause(id),
  relative_score INT DEFAULT 50 CHECK (relative_score BETWEEN 0 AND 100),
  evidence_for TEXT[] DEFAULT '{}', evidence_against TEXT[] DEFAULT '{}',
  requires_verification BOOLEAN DEFAULT true, active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (symptom_id, cause_id)
);

INSERT INTO public.__diag_system (id, slug, label) VALUES
  (1, 'filtration', 'Filtration'), (2, 'injection', 'Injection'), (3, 'clim', 'Climatisation');
INSERT INTO public.__diag_symptom (id, slug, system_id, label) VALUES
  (10, 'perte_puissance_filtration', 1, 'Perte de puissance'),
  (11, 'odeur_habitacle', 1, 'Odeur dans l''habitacle');
INSERT INTO public.__diag_cause (id, slug, system_id, label) VALUES
  (20, 'filtre_air_colmate', 1, 'Filtre à air colmaté'),
  (21, 'filtre_carburant_colmate', 1, 'Filtre à carburant colmaté'),
  (22, 'filtre_habitacle_sature', 1, 'Filtre d''habitacle saturé'),
  (23, 'filtre_carburant_injection', 2, 'Filtre à carburant (injection)'),
  (24, 'filtre_habitacle_clim', 3, 'Filtre d''habitacle (clim)');
INSERT INTO public.__diag_symptom_cause_link (id, symptom_id, cause_id, relative_score) VALUES
  (113, 10, 20, 60), (114, 10, 21, 50), (117, 11, 22, 70);
DO $$ BEGIN PERFORM setval(pg_get_serial_sequence('public.__diag_symptom_cause_link', 'id'), 200); END $$;
