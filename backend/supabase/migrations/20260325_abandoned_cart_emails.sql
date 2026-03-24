-- Migration: Abandoned cart email recovery system
-- Table to track detected abandoned carts and email sequences

CREATE TABLE IF NOT EXISTS __abandoned_cart_emails (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cst_id          INTEGER NOT NULL,
  cst_mail        TEXT NOT NULL,
  cst_fname       TEXT,
  session_id      TEXT NOT NULL,
  cart_snapshot    JSONB NOT NULL,
  cart_subtotal    NUMERIC(10,2) NOT NULL,
  cart_item_count  INTEGER NOT NULL,
  recovery_token   TEXT NOT NULL UNIQUE,

  -- Email sequence (3 steps)
  email_1h_sent_at   TIMESTAMPTZ,
  email_24h_sent_at  TIMESTAMPTZ,
  email_72h_sent_at  TIMESTAMPTZ,

  -- Metrics
  email_opened_at    TIMESTAMPTZ,
  email_clicked_at   TIMESTAMPTZ,
  recovered_at       TIMESTAMPTZ,
  unsubscribed_at    TIMESTAMPTZ,

  -- Lifecycle
  status    TEXT NOT NULL DEFAULT 'detected',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '30 days'
);

CREATE INDEX IF NOT EXISTS idx_ace_status ON __abandoned_cart_emails(status) WHERE status IN ('detected', 'emailing');
CREATE INDEX IF NOT EXISTS idx_ace_cst_id ON __abandoned_cart_emails(cst_id);
CREATE INDEX IF NOT EXISTS idx_ace_recovery_token ON __abandoned_cart_emails(recovery_token);
