-- Migration: Auth Unified Lookup
-- Résout le problème récurrent de dual-table auth (___config_admin + ___xtr_customer)
-- 3 objets : RPC auth_resolve_user, RPC auth_email_exists, trigger anti-doublon

-- 1. RPC auth_resolve_user : lookup unifié cross-tables, admin prioritaire
CREATE OR REPLACE FUNCTION auth_resolve_user(p_email TEXT)
RETURNS TABLE(
  user_id TEXT,
  email TEXT,
  password_hash TEXT,
  first_name TEXT,
  last_name TEXT,
  level INT,
  is_active BOOLEAN,
  auth_source TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_email TEXT := lower(trim(p_email));
BEGIN
  -- Admin first (priorité)
  RETURN QUERY
    SELECT cnfa_id::TEXT, cnfa_mail::TEXT, cnfa_pswd::TEXT,
           COALESCE(cnfa_fname,'')::TEXT, COALESCE(cnfa_name,'')::TEXT,
           COALESCE(cnfa_level::INT, 7), (cnfa_activ = '1'), 'admin'::TEXT
    FROM ___config_admin
    WHERE cnfa_mail = v_email AND cnfa_activ = '1'
    LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- Customer fallback
  RETURN QUERY
    SELECT cst_id::TEXT, cst_mail::TEXT, cst_pswd::TEXT,
           COALESCE(cst_fname,'')::TEXT, COALESCE(cst_name,'')::TEXT,
           COALESCE(cst_level::INT, 1), (cst_activ = '1'), 'customer'::TEXT
    FROM ___xtr_customer
    WHERE cst_mail = v_email AND cst_activ = '1'
    LIMIT 1;
END;
$$;

-- 2. RPC auth_email_exists : check rapide cross-tables pour registration
CREATE OR REPLACE FUNCTION auth_email_exists(p_email TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_email TEXT := lower(trim(p_email));
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM ___config_admin WHERE cnfa_mail = v_email
  ) OR EXISTS (
    SELECT 1 FROM ___xtr_customer WHERE cst_mail = v_email
  );
END;
$$;

-- 3. Trigger anti-doublon : empêche insertion customer si email admin existe
CREATE OR REPLACE FUNCTION trg_prevent_customer_admin_overlap()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM ___config_admin WHERE cnfa_mail = lower(trim(NEW.cst_mail))) THEN
    RAISE EXCEPTION 'Email % already exists as admin account', NEW.cst_mail;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customer_no_admin_overlap ON ___xtr_customer;

CREATE TRIGGER trg_customer_no_admin_overlap
  BEFORE INSERT ON ___xtr_customer
  FOR EACH ROW EXECUTE FUNCTION trg_prevent_customer_admin_overlap();
