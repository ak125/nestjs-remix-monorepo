-- ============================================================
-- Idempotence transactionnelle + tokens de reprise paiement
-- V4 PROD-READY : FK nullable, updated_at, token aléatoire DB
-- ============================================================

-- Table d'idempotence serveur pour les commandes
CREATE TABLE IF NOT EXISTS order_idempotency (
  idempotency_key TEXT PRIMARY KEY,
  order_id TEXT NULL REFERENCES "___xtr_order"(ord_id),  -- NULL pendant processing
  fingerprint TEXT NOT NULL,                              -- SHA256 du payload canonique
  status TEXT NOT NULL DEFAULT 'processing',              -- processing | completed | failed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),          -- pour cleanup basé sur inactivité
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX IF NOT EXISTS idx_idem_expires ON order_idempotency(expires_at);
CREATE INDEX IF NOT EXISTS idx_idem_status ON order_idempotency(status) WHERE status = 'processing';

-- Tokens de reprise paiement (guest-compatible, expiration, usage unique)
CREATE TABLE IF NOT EXISTS order_resume_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL REFERENCES "___xtr_order"(ord_id),
  token TEXT NOT NULL UNIQUE,               -- token aléatoire 48 chars
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '2 hours',
  used_at TIMESTAMPTZ NULL,                 -- NULL = pas encore utilisé
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resume_token ON order_resume_tokens(token) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_resume_expires ON order_resume_tokens(expires_at);

-- Ajout colonne payment_confirmed atomique sur ___xtr_order
-- Guard pour n'envoyer le purchase GA4 qu'une seule fois
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '___xtr_order' AND column_name = 'payment_confirmed'
  ) THEN
    ALTER TABLE "___xtr_order" ADD COLUMN payment_confirmed BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Ajout colonne ga_client_id pour Measurement Protocol purchase
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '___xtr_order' AND column_name = 'ga_client_id'
  ) THEN
    ALTER TABLE "___xtr_order" ADD COLUMN ga_client_id TEXT NULL;
  END IF;
END $$;
