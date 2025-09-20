-- ╔══════════════════════════════════════════════════════════════════╗
-- ║                    TABLES PANIER - SCHEMA COMPLET                ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- 🛒 Table principale du panier
CREATE TABLE IF NOT EXISTS cart_items (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL REFERENCES ___xtr_customer(cst_id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES pieces(piece_id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  options JSONB DEFAULT '{}',
  product_name VARCHAR(255), -- Cache pour performance
  product_sku VARCHAR(100),   -- Cache pour identification
  weight DECIMAL(8,2),        -- Pour calculs livraison
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, product_id, options) -- Support variants
);

-- 🛒 Métadonnées du panier (session/état)
CREATE TABLE IF NOT EXISTS cart_metadata (
  user_id VARCHAR(50) PRIMARY KEY REFERENCES ___xtr_customer(cst_id) ON DELETE CASCADE,
  promo_code VARCHAR(50),
  promo_discount DECIMAL(10,2) DEFAULT 0,
  promo_applied_at TIMESTAMP,
  shipping_cost DECIMAL(10,2) DEFAULT 0,
  shipping_address_id INTEGER,
  shipping_method VARCHAR(50),
  shipping_zone VARCHAR(20),
  tax_amount DECIMAL(10,2) DEFAULT 0,
  tax_rate DECIMAL(5,4) DEFAULT 0,
  subtotal DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'EUR',
  notes TEXT,
  session_id VARCHAR(255), -- Pour utilisateurs non connectés
  expires_at TIMESTAMP,    -- Expiration automatique
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 🎫 Table des codes promo (référence existante optimisée)
CREATE TABLE IF NOT EXISTS promo_codes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  type VARCHAR(20) CHECK (type IN ('PERCENT', 'AMOUNT', 'SHIPPING', 'BUY_X_GET_Y')) NOT NULL,
  value DECIMAL(10,2) NOT NULL CHECK (value >= 0),
  min_amount DECIMAL(10,2) DEFAULT 0,
  max_discount DECIMAL(10,2),
  min_items INTEGER DEFAULT 1,
  applicable_products JSONB DEFAULT '[]', -- IDs produits spécifiques
  applicable_categories JSONB DEFAULT '[]', -- Catégories applicables
  customer_groups JSONB DEFAULT '[]', -- Groupes clients autorisés
  valid_from TIMESTAMP NOT NULL,
  valid_until TIMESTAMP NOT NULL,
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  usage_limit_per_customer INTEGER DEFAULT 1,
  stackable BOOLEAN DEFAULT false, -- Cumul avec autres promos
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 🎫 Historique d'utilisation des promos
CREATE TABLE IF NOT EXISTS promo_usage (
  id SERIAL PRIMARY KEY,
  promo_id INTEGER NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id VARCHAR(50) NOT NULL REFERENCES ___xtr_customer(cst_id) ON DELETE CASCADE,
  order_id VARCHAR(50) REFERENCES ___xtr_order(ord_id) ON DELETE SET NULL,
  cart_session_id VARCHAR(255), -- Pour paniers temporaires
  discount_amount DECIMAL(10,2) NOT NULL,
  original_total DECIMAL(10,2) NOT NULL,
  final_total DECIMAL(10,2) NOT NULL,
  used_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(promo_id, user_id, order_id)
);

-- 🚚 Cache des frais de livraison
CREATE TABLE IF NOT EXISTS shipping_rates_cache (
  id SERIAL PRIMARY KEY,
  zip_code VARCHAR(10) NOT NULL,
  country VARCHAR(2) NOT NULL,
  zone VARCHAR(20) NOT NULL,
  weight_min DECIMAL(8,2) NOT NULL,
  weight_max DECIMAL(8,2) NOT NULL,
  rate DECIMAL(10,2) NOT NULL,
  method VARCHAR(50) NOT NULL,
  delivery_time VARCHAR(50),
  cached_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours'),
  UNIQUE(zip_code, country, weight_min, weight_max, method)
);

-- 📊 Statistiques panier (analytics)
CREATE TABLE IF NOT EXISTS cart_analytics (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(50) REFERENCES ___xtr_customer(cst_id) ON DELETE SET NULL,
  session_id VARCHAR(255),
  event_type VARCHAR(50) NOT NULL, -- 'add', 'remove', 'update', 'abandon', 'checkout'
  product_id INTEGER REFERENCES pieces(piece_id) ON DELETE SET NULL,
  quantity INTEGER,
  price DECIMAL(10,2),
  total_items INTEGER,
  total_value DECIMAL(10,2),
  promo_code VARCHAR(50),
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║                              INDEX                               ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- Index principaux pour cart_items
CREATE INDEX IF NOT EXISTS idx_cart_items_user ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product ON cart_items(product_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_user_product ON cart_items(user_id, product_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_updated ON cart_items(updated_at);

-- Index pour cart_metadata
CREATE INDEX IF NOT EXISTS idx_cart_metadata_promo ON cart_metadata(promo_code) WHERE promo_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cart_metadata_session ON cart_metadata(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cart_metadata_expires ON cart_metadata(expires_at) WHERE expires_at IS NOT NULL;

-- Index pour promo_codes (optimisés)
CREATE INDEX IF NOT EXISTS idx_promo_codes_code_active ON promo_codes(code, active);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active_dates ON promo_codes(active, valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_promo_codes_type ON promo_codes(type, active);

-- Index pour promo_usage
CREATE INDEX IF NOT EXISTS idx_promo_usage_user ON promo_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_promo_usage_promo ON promo_usage(promo_id);
CREATE INDEX IF NOT EXISTS idx_promo_usage_date ON promo_usage(used_at);

-- Index pour shipping_rates_cache
CREATE INDEX IF NOT EXISTS idx_shipping_cache_location ON shipping_rates_cache(zip_code, country);
CREATE INDEX IF NOT EXISTS idx_shipping_cache_expires ON shipping_rates_cache(expires_at);

-- Index pour cart_analytics
CREATE INDEX IF NOT EXISTS idx_cart_analytics_user ON cart_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_analytics_session ON cart_analytics(session_id);
CREATE INDEX IF NOT EXISTS idx_cart_analytics_event ON cart_analytics(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_cart_analytics_product ON cart_analytics(product_id, event_type);

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║                            TRIGGERS                              ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- Fonction de mise à jour automatique des timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers pour updated_at
DROP TRIGGER IF EXISTS update_cart_items_updated_at ON cart_items;
CREATE TRIGGER update_cart_items_updated_at
    BEFORE UPDATE ON cart_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cart_metadata_updated_at ON cart_metadata;
CREATE TRIGGER update_cart_metadata_updated_at
    BEFORE UPDATE ON cart_metadata
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_promo_codes_updated_at ON promo_codes;
CREATE TRIGGER update_promo_codes_updated_at
    BEFORE UPDATE ON promo_codes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger pour mise à jour automatique des totaux panier
CREATE OR REPLACE FUNCTION update_cart_totals()
RETURNS TRIGGER AS $$
DECLARE
    cart_user_id VARCHAR(50);
    new_subtotal DECIMAL(10,2);
BEGIN
    -- Récupérer user_id selon le type d'opération
    IF TG_OP = 'DELETE' THEN
        cart_user_id = OLD.user_id;
    ELSE
        cart_user_id = NEW.user_id;
    END IF;
    
    -- Calculer nouveau sous-total
    SELECT COALESCE(SUM(price * quantity), 0)
    INTO new_subtotal
    FROM cart_items
    WHERE user_id = cart_user_id;
    
    -- Mettre à jour cart_metadata
    INSERT INTO cart_metadata (user_id, subtotal, updated_at)
    VALUES (cart_user_id, new_subtotal, NOW())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        subtotal = EXCLUDED.subtotal,
        total = EXCLUDED.subtotal + COALESCE(cart_metadata.shipping_cost, 0) + COALESCE(cart_metadata.tax_amount, 0) - COALESCE(cart_metadata.promo_discount, 0),
        updated_at = NOW();
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ language 'plpgsql';

-- Trigger pour recalcul automatique
DROP TRIGGER IF EXISTS trigger_update_cart_totals ON cart_items;
CREATE TRIGGER trigger_update_cart_totals
    AFTER INSERT OR UPDATE OR DELETE ON cart_items
    FOR EACH ROW EXECUTE FUNCTION update_cart_totals();

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║                         FONCTIONS UTILES                        ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- Fonction pour nettoyer les paniers expirés
CREATE OR REPLACE FUNCTION cleanup_expired_carts()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Supprimer les paniers expirés
    DELETE FROM cart_metadata 
    WHERE expires_at IS NOT NULL AND expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Supprimer les items orphelins
    DELETE FROM cart_items 
    WHERE user_id NOT IN (SELECT user_id FROM cart_metadata);
    
    RETURN deleted_count;
END;
$$ language 'plpgsql';

-- Fonction pour obtenir statistiques panier
CREATE OR REPLACE FUNCTION get_cart_stats(p_user_id VARCHAR(50))
RETURNS TABLE (
    item_count INTEGER,
    total_quantity INTEGER,
    subtotal DECIMAL(10,2),
    total DECIMAL(10,2),
    has_promo BOOLEAN,
    promo_discount DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(ci.id)::INTEGER as item_count,
        COALESCE(SUM(ci.quantity), 0)::INTEGER as total_quantity,
        COALESCE(cm.subtotal, 0) as subtotal,
        COALESCE(cm.total, 0) as total,
        (cm.promo_code IS NOT NULL) as has_promo,
        COALESCE(cm.promo_discount, 0) as promo_discount
    FROM cart_metadata cm
    LEFT JOIN cart_items ci ON cm.user_id = ci.user_id
    WHERE cm.user_id = p_user_id
    GROUP BY cm.subtotal, cm.total, cm.promo_code, cm.promo_discount;
END;
$$ language 'plpgsql';

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║                         DONNÉES DE TEST                         ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- Codes promo de test (si pas déjà présents)
INSERT INTO promo_codes (code, type, value, min_amount, valid_from, valid_until, usage_limit, description)
VALUES 
    ('CART10', 'PERCENT', 10.00, 50.00, '2025-01-01', '2025-12-31', 1000, 'Réduction 10% sur panier de 50€+'),
    ('FREESHIP', 'SHIPPING', 100.00, 30.00, '2025-01-01', '2025-12-31', 500, 'Livraison gratuite dès 30€'),
    ('WELCOME5', 'AMOUNT', 5.00, 25.00, '2025-01-01', '2025-12-31', NULL, 'Réduction 5€ de bienvenue')
ON CONFLICT (code) DO NOTHING;

-- Zones de livraison de test
INSERT INTO shipping_rates_cache (zip_code, country, zone, weight_min, weight_max, rate, method, delivery_time)
VALUES 
    ('75%', 'FR', 'PARIS', 0.0, 2.0, 5.90, 'STANDARD', '2-3 jours'),
    ('75%', 'FR', 'PARIS', 2.0, 5.0, 8.90, 'STANDARD', '2-3 jours'),
    ('75%', 'FR', 'PARIS', 0.0, 1.0, 12.90, 'EXPRESS', '24h'),
    ('%', 'FR', 'FRANCE', 0.0, 2.0, 7.90, 'STANDARD', '3-5 jours'),
    ('%', 'FR', 'FRANCE', 2.0, 10.0, 12.90, 'STANDARD', '3-5 jours')
ON CONFLICT (zip_code, country, weight_min, weight_max, method) DO NOTHING;
