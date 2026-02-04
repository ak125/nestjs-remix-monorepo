-- =====================================================
-- KILL-SWITCH DEV: Phase 4 - Break-Glass Mechanism
-- Date: 2026-02-04
-- Permet un accès temporaire d'urgence (max 24h)
-- =====================================================

BEGIN;

-- =====================================================
-- TABLE DE CONTRÔLE BREAK-GLASS
-- =====================================================
CREATE TABLE IF NOT EXISTS _killswitch_breakglass (
  id SERIAL PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  granted_by TEXT NOT NULL,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL,
  tables_allowed TEXT[] NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  revoked_at TIMESTAMPTZ,
  revoked_by TEXT,

  -- Contrainte: expiration max 24h
  CONSTRAINT breakglass_max_duration CHECK (
    expires_at <= granted_at + INTERVAL '24 hours'
  )
);

-- Index pour lookup rapide des tokens actifs
CREATE INDEX IF NOT EXISTS idx_breakglass_active
  ON _killswitch_breakglass(is_active, expires_at)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_breakglass_token
  ON _killswitch_breakglass(token_hash)
  WHERE is_active = TRUE;

-- =====================================================
-- FONCTION: Vérifier si break-glass actif
-- Appelable par dev_readonly pour vérifier accès
-- =====================================================
CREATE OR REPLACE FUNCTION check_breakglass(p_token TEXT, p_table TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed BOOLEAN := FALSE;
BEGIN
  -- Vérifier si un break-glass actif existe pour ce token et cette table
  SELECT TRUE INTO v_allowed
  FROM _killswitch_breakglass
  WHERE token_hash = encode(sha256(p_token::bytea), 'hex')
    AND is_active = TRUE
    AND expires_at > NOW()
    AND (p_table = ANY(tables_allowed) OR 'ALL' = ANY(tables_allowed));

  -- Logger la vérification
  INSERT INTO _killswitch_audit (role_name, operation, table_name, blocked, context)
  VALUES (
    current_user,
    'BREAKGLASS_CHECK',
    p_table,
    NOT COALESCE(v_allowed, FALSE),
    jsonb_build_object('token_provided', p_token IS NOT NULL, 'result', COALESCE(v_allowed, FALSE))
  );

  RETURN COALESCE(v_allowed, FALSE);
END;
$$;

-- =====================================================
-- FONCTION: Accorder break-glass (admin only)
-- Durée max 24h, raison obligatoire
-- =====================================================
CREATE OR REPLACE FUNCTION grant_breakglass(
  p_token TEXT,
  p_granted_by TEXT,
  p_reason TEXT,
  p_tables TEXT[],
  p_hours INT DEFAULT 4
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id BIGINT;
  v_token_hash TEXT;
BEGIN
  -- Validation: max 24 heures
  IF p_hours > 24 THEN
    RAISE EXCEPTION 'Break-glass duration cannot exceed 24 hours (requested: % hours)', p_hours;
  END IF;

  IF p_hours < 1 THEN
    RAISE EXCEPTION 'Break-glass duration must be at least 1 hour';
  END IF;

  -- Validation: token non vide
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RAISE EXCEPTION 'Break-glass token must be at least 16 characters';
  END IF;

  -- Validation: raison obligatoire
  IF p_reason IS NULL OR length(p_reason) < 10 THEN
    RAISE EXCEPTION 'Break-glass reason must be at least 10 characters';
  END IF;

  -- Validation: tables spécifiées
  IF p_tables IS NULL OR array_length(p_tables, 1) = 0 THEN
    RAISE EXCEPTION 'Break-glass must specify at least one table';
  END IF;

  -- Calculer hash du token
  v_token_hash := encode(sha256(p_token::bytea), 'hex');

  -- Vérifier si ce token existe déjà
  IF EXISTS (SELECT 1 FROM _killswitch_breakglass WHERE token_hash = v_token_hash AND is_active = TRUE) THEN
    RAISE EXCEPTION 'This token is already in use for an active break-glass';
  END IF;

  -- Créer le break-glass
  INSERT INTO _killswitch_breakglass (
    token_hash,
    granted_by,
    reason,
    tables_allowed,
    expires_at
  ) VALUES (
    v_token_hash,
    p_granted_by,
    p_reason,
    p_tables,
    NOW() + (p_hours || ' hours')::INTERVAL
  ) RETURNING id INTO v_id;

  -- Logger l'activation
  INSERT INTO _killswitch_audit (role_name, operation, table_name, blocked, context)
  VALUES (
    current_user,
    'BREAKGLASS_GRANT',
    array_to_string(p_tables, ','),
    FALSE,
    jsonb_build_object(
      'breakglass_id', v_id,
      'granted_by', p_granted_by,
      'hours', p_hours,
      'reason', p_reason
    )
  );

  RAISE NOTICE 'Break-glass #% granted for % hours on tables: %', v_id, p_hours, array_to_string(p_tables, ', ');

  RETURN v_id;
END;
$$;

-- =====================================================
-- FONCTION: Révoquer break-glass
-- =====================================================
CREATE OR REPLACE FUNCTION revoke_breakglass(p_id BIGINT, p_revoked_by TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_found BOOLEAN;
BEGIN
  UPDATE _killswitch_breakglass
  SET
    is_active = FALSE,
    revoked_at = NOW(),
    revoked_by = p_revoked_by
  WHERE id = p_id AND is_active = TRUE;

  v_found := FOUND;

  IF v_found THEN
    -- Logger la révocation
    INSERT INTO _killswitch_audit (role_name, operation, table_name, blocked, context)
    VALUES (
      current_user,
      'BREAKGLASS_REVOKE',
      NULL,
      FALSE,
      jsonb_build_object('breakglass_id', p_id, 'revoked_by', p_revoked_by)
    );

    RAISE NOTICE 'Break-glass #% revoked by %', p_id, p_revoked_by;
  ELSE
    RAISE NOTICE 'Break-glass #% not found or already revoked', p_id;
  END IF;

  RETURN v_found;
END;
$$;

-- =====================================================
-- FONCTION: Lister break-glass actifs
-- =====================================================
CREATE OR REPLACE FUNCTION list_active_breakglass()
RETURNS TABLE (
  id INT,
  granted_by TEXT,
  granted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  time_remaining INTERVAL,
  reason TEXT,
  tables_allowed TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bg.id,
    bg.granted_by,
    bg.granted_at,
    bg.expires_at,
    bg.expires_at - NOW() AS time_remaining,
    bg.reason,
    bg.tables_allowed
  FROM _killswitch_breakglass bg
  WHERE bg.is_active = TRUE
    AND bg.expires_at > NOW()
  ORDER BY bg.expires_at ASC;
END;
$$;

-- =====================================================
-- PERMISSIONS
-- =====================================================

-- dev_readonly peut vérifier son break-glass
GRANT EXECUTE ON FUNCTION check_breakglass(TEXT, TEXT) TO dev_readonly;

-- grant/revoke réservés au service_role (admin)
-- Supabase: service_role a déjà tous les droits

-- Liste accessible à tous les rôles authentifiés
GRANT EXECUTE ON FUNCTION list_active_breakglass() TO authenticated;
GRANT EXECUTE ON FUNCTION list_active_breakglass() TO service_role;

-- =====================================================
-- NETTOYAGE AUTOMATIQUE (optionnel)
-- Désactive les break-glass expirés
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_expired_breakglass()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE _killswitch_breakglass
  SET is_active = FALSE
  WHERE is_active = TRUE
    AND expires_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 THEN
    INSERT INTO _killswitch_audit (role_name, operation, table_name, blocked, context)
    VALUES ('system', 'BREAKGLASS_CLEANUP', NULL, FALSE, jsonb_build_object('expired_count', v_count));
  END IF;

  RETURN v_count;
END;
$$;

-- Log final
DO $$
BEGIN
  RAISE NOTICE 'Kill-switch DEV: Break-glass mechanism installed';
  RAISE NOTICE 'Usage: SELECT grant_breakglass(token, granted_by, reason, tables, hours)';
  RAISE NOTICE 'Check: SELECT list_active_breakglass()';
END
$$;

COMMIT;
