-- =============================================================================
-- Fixture de test : ce que cancel_order_atomic lit et écrit, et rien de plus.
--
-- Utilisée par scripts/db/test-cancel-order-atomic-refuse-paid.sh, sur un
-- conteneur PostgreSQL jetable. Ne s'applique à AUCUNE base réelle.
--
-- Ce fichier ne recopie AUCUNE fonction : le test applique ensuite les vraies
-- migrations du dépôt (20260523_001 pour l'historique et append_order_event,
-- 20260523_002 pour la RPC d'origine). Il ne pose que ce qu'elles supposent
-- déjà présent sur la base live.
--
-- Types relevés sur la base live le 2026-09-24 (information_schema, lecture
-- seule) : ord_id, ord_ords_id, ord_is_pay, ord_date_pay et ord_cancel_reason
-- sont TEXT ; ord_cancel_date et ord_updated_at sont TIMESTAMPTZ. La table live
-- a d'autres colonnes, que la RPC ne lit ni n'écrit.
-- =============================================================================

-- Rôles d'API Supabase.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Privilèges par défaut Supabase : EXECUTE accordé aux rôles d'API sur toute
-- fonction NOUVELLEMENT créée. Reproduit ici pour que les assertions de droits
-- portent sur le même point de départ que la base live.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- Référentiel des statuts (cible des clés étrangères de l'historique).
-- Valeurs live : 1 à 5. Le statut '6', présent sur quelques commandes, n'y
-- figure PAS.
CREATE TABLE public.___xtr_order_status (
  ords_id TEXT PRIMARY KEY
);
INSERT INTO public.___xtr_order_status (ords_id) VALUES ('1'), ('2'), ('3'), ('4'), ('5');

CREATE TABLE public.___xtr_order (
  ord_id            TEXT PRIMARY KEY,
  ord_ords_id       TEXT,
  ord_is_pay        TEXT,
  ord_date_pay      TEXT,
  ord_cancel_date   TIMESTAMPTZ,
  ord_cancel_reason TEXT,
  ord_updated_at    TIMESTAMPTZ
);
