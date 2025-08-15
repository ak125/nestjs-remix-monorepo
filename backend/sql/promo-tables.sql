-- Script SQL pour les tables de codes promotionnels

-- Table des codes promo
CREATE TABLE IF NOT EXISTS promo_codes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('PERCENT', 'AMOUNT', 'SHIPPING')),
  value DECIMAL(10,2) NOT NULL CHECK (value >= 0),
  min_amount DECIMAL(10,2) DEFAULT NULL,
  max_discount DECIMAL(10,2) DEFAULT NULL,
  valid_from TIMESTAMP NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMP NOT NULL,
  usage_limit INTEGER DEFAULT NULL,
  usage_count INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER DEFAULT NULL,
  description TEXT DEFAULT NULL
);

-- Table d'utilisation des codes promo
CREATE TABLE IF NOT EXISTS promo_usage (
  id SERIAL PRIMARY KEY,
  promo_id INTEGER NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  order_id INTEGER DEFAULT NULL,
  used_at TIMESTAMP DEFAULT NOW(),
  discount_amount DECIMAL(10,2) DEFAULT 0
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes(active);
CREATE INDEX IF NOT EXISTS idx_promo_codes_dates ON promo_codes(valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_promo_usage_promo_user ON promo_usage(promo_id, user_id);
CREATE INDEX IF NOT EXISTS idx_promo_usage_order ON promo_usage(order_id);

-- Données d'exemple
INSERT INTO promo_codes (code, type, value, min_amount, max_discount, valid_from, valid_until, usage_limit, description) VALUES
('WELCOME10', 'PERCENT', 10.00, 50.00, 20.00, NOW(), NOW() + INTERVAL '30 days', 100, 'Remise de bienvenue 10%'),
('SHIPPING5', 'SHIPPING', 0.00, 30.00, NULL, NOW(), NOW() + INTERVAL '60 days', NULL, 'Livraison gratuite dès 30€'),
('FIXED15', 'AMOUNT', 15.00, 100.00, NULL, NOW(), NOW() + INTERVAL '15 days', 50, 'Remise fixe de 15€ dès 100€'),
('SUMMER20', 'PERCENT', 20.00, 80.00, 50.00, NOW(), NOW() + INTERVAL '90 days', 200, 'Promotion été 20%')
ON CONFLICT (code) DO NOTHING;

-- Fonction pour auto-update de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger pour auto-update
DROP TRIGGER IF EXISTS update_promo_codes_updated_at ON promo_codes;
CREATE TRIGGER update_promo_codes_updated_at
    BEFORE UPDATE ON promo_codes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
