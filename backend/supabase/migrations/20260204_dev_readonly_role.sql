-- =====================================================
-- KILL-SWITCH DEV: Phase 1 - Création rôle READ-ONLY
-- Date: 2026-02-04
-- Transaction-safe, rollback possible
-- =====================================================

BEGIN;

-- 1. Créer le rôle dev_readonly (s'il n'existe pas)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dev_readonly') THEN
    CREATE ROLE dev_readonly WITH
      LOGIN
      NOINHERIT
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION;
    RAISE NOTICE 'Role dev_readonly created successfully';
  ELSE
    RAISE NOTICE 'Role dev_readonly already exists, skipping creation';
  END IF;
END
$$;

-- 2. Révoquer tout par défaut
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM dev_readonly;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM dev_readonly;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM dev_readonly;

-- 3. Accorder USAGE sur le schema et SELECT uniquement sur tables
GRANT USAGE ON SCHEMA public TO dev_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO dev_readonly;

-- 4. Configurer les privilèges par défaut pour futures tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO dev_readonly;

-- 5. Bloquer explicitement les opérations d'écriture
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public FROM dev_readonly;

-- 6. Bloquer DDL (création d'objets)
REVOKE CREATE ON SCHEMA public FROM dev_readonly;

-- 7. Log de création
DO $$
BEGIN
  RAISE NOTICE 'Kill-switch DEV: Role dev_readonly configured with SELECT-only permissions';
END
$$;

COMMIT;
