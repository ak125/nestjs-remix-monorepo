-- =====================================================
-- SCHÉMA ORDERS - Architecture Optimisée
-- Compatible avec OrdersSimpleEnhancedService
-- =====================================================

-- Table principale des commandes
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_number VARCHAR(20) UNIQUE NOT NULL,
  customer_id INTEGER NOT NULL,
  status INTEGER DEFAULT 1, -- OrderStatus.PENDING
  
  -- Montants
  subtotal DECIMAL(10,2) DEFAULT 0,
  tax DECIMAL(10,2) DEFAULT 0,
  tax_rate DECIMAL(5,4) DEFAULT 0.20,
  shipping_fee DECIMAL(10,2) DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'EUR',
  
  -- Adresses
  shipping_address_id INTEGER,
  billing_address_id INTEGER,
  
  -- Méthodes
  shipping_method_id INTEGER,
  payment_method_id INTEGER,
  
  -- Notes
  customer_notes TEXT,
  internal_notes TEXT,
  
  -- Dates de traitement
  paid_at TIMESTAMP,
  shipped_at TIMESTAMP,
  delivered_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  deleted_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Lignes de commande
CREATE TABLE IF NOT EXISTS order_lines (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL,
  product_reference VARCHAR(100),
  product_name VARCHAR(255),
  product_sku VARCHAR(100),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  status INTEGER DEFAULT 1, -- OrderLineStatus.PENDING
  supplier_order_ref VARCHAR(100),
  tracking_number VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Historique des statuts de commande
CREATE TABLE IF NOT EXISTS order_status_history (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  old_status INTEGER,
  new_status INTEGER NOT NULL,
  reason TEXT,
  comment TEXT,
  changed_by INTEGER, -- user_id who made the change
  changed_at TIMESTAMP DEFAULT NOW()
);

-- Historique des statuts de ligne
CREATE TABLE IF NOT EXISTS order_line_status_history (
  id SERIAL PRIMARY KEY,
  order_line_id INTEGER NOT NULL REFERENCES order_lines(id) ON DELETE CASCADE,
  old_status INTEGER,
  new_status INTEGER NOT NULL,
  reason TEXT,
  comment TEXT,
  changed_by INTEGER,
  changed_at TIMESTAMP DEFAULT NOW()
);

-- Table des factures
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  order_id INTEGER UNIQUE NOT NULL REFERENCES orders(id),
  invoice_number VARCHAR(20) UNIQUE NOT NULL,
  issued_at TIMESTAMP DEFAULT NOW(),
  due_at TIMESTAMP,
  subtotal DECIMAL(10,2) NOT NULL,
  tax DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  pdf_url VARCHAR(500),
  status VARCHAR(20) DEFAULT 'pending', -- pending, paid, overdue, cancelled
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table des méthodes de paiement
CREATE TABLE IF NOT EXISTS payment_methods (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) UNIQUE NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT true,
  config JSON, -- Configuration spécifique au provider
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table des méthodes de livraison
CREATE TABLE IF NOT EXISTS shipping_methods (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) UNIQUE NOT NULL,
  description TEXT,
  base_cost DECIMAL(10,2) DEFAULT 0,
  cost_per_kg DECIMAL(10,2) DEFAULT 0,
  free_shipping_threshold DECIMAL(10,2),
  estimated_days_min INTEGER,
  estimated_days_max INTEGER,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- INDEX POUR OPTIMISATION
-- =====================================================

-- Index principaux pour orders
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_total ON orders(total);

-- Index pour order_lines
CREATE INDEX IF NOT EXISTS idx_order_lines_order ON order_lines(order_id);
CREATE INDEX IF NOT EXISTS idx_order_lines_product ON order_lines(product_id);
CREATE INDEX IF NOT EXISTS idx_order_lines_status ON order_lines(status);

-- Index pour historiques
CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_date ON order_status_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_order_line_status_history_line ON order_line_status_history(order_line_id);

-- Index pour factures
CREATE INDEX IF NOT EXISTS idx_invoices_order ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- =====================================================
-- CONTRAINTES ET TRIGGERS
-- =====================================================

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers pour updated_at
CREATE TRIGGER update_orders_updated_at 
    BEFORE UPDATE ON orders 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_order_lines_updated_at 
    BEFORE UPDATE ON order_lines 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at 
    BEFORE UPDATE ON invoices 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- DONNÉES DE BASE
-- =====================================================

-- Méthodes de paiement par défaut
INSERT INTO payment_methods (name, code, description, active) VALUES
('Carte bancaire', 'credit_card', 'Paiement par carte bancaire', true),
('PayPal', 'paypal', 'Paiement via PayPal', true),
('Virement bancaire', 'bank_transfer', 'Paiement par virement bancaire', true),
('Chèque', 'check', 'Paiement par chèque', false)
ON CONFLICT (code) DO NOTHING;

-- Méthodes de livraison par défaut
INSERT INTO shipping_methods (name, code, description, base_cost, cost_per_kg, free_shipping_threshold, estimated_days_min, estimated_days_max, active) VALUES
('Standard', 'standard', 'Livraison standard', 5.90, 0.50, 50.00, 3, 5, true),
('Express', 'express', 'Livraison express', 12.90, 1.00, 100.00, 1, 2, true),
('Gratuite', 'free', 'Livraison gratuite', 0.00, 0.00, 50.00, 5, 7, true),
('Point relais', 'pickup_point', 'Livraison en point relais', 3.90, 0.30, 30.00, 2, 4, true)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- VUES UTILES
-- =====================================================

-- Vue pour les commandes avec détails
CREATE OR REPLACE VIEW orders_with_details AS
SELECT 
    o.*,
    COUNT(ol.id) as line_count,
    SUM(ol.quantity) as total_items,
    pm.name as payment_method_name,
    sm.name as shipping_method_name
FROM orders o
LEFT JOIN order_lines ol ON o.id = ol.order_id
LEFT JOIN payment_methods pm ON o.payment_method_id = pm.id
LEFT JOIN shipping_methods sm ON o.shipping_method_id = sm.id
GROUP BY o.id, pm.name, sm.name;

-- Vue pour les statistiques des commandes
CREATE OR REPLACE VIEW order_stats AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    status,
    COUNT(*) as order_count,
    SUM(total) as total_revenue,
    AVG(total) as avg_order_value
FROM orders
WHERE deleted_at IS NULL
GROUP BY DATE_TRUNC('day', created_at), status
ORDER BY date DESC;

-- =====================================================
-- COMMENTAIRES ET DOCUMENTATION
-- =====================================================

COMMENT ON TABLE orders IS 'Table principale des commandes';
COMMENT ON COLUMN orders.status IS 'Statut de la commande selon OrderStatus enum';
COMMENT ON COLUMN orders.order_number IS 'Numéro de commande unique (ex: CMD-202508110001)';
COMMENT ON COLUMN orders.customer_id IS 'ID du client (référence externe)';

COMMENT ON TABLE order_lines IS 'Lignes de commande (produits commandés)';
COMMENT ON COLUMN order_lines.status IS 'Statut de la ligne selon OrderLineStatus enum';

COMMENT ON TABLE order_status_history IS 'Historique des changements de statut des commandes';
COMMENT ON TABLE order_line_status_history IS 'Historique des changements de statut des lignes';

COMMENT ON TABLE invoices IS 'Factures associées aux commandes';
COMMENT ON TABLE payment_methods IS 'Méthodes de paiement disponibles';
COMMENT ON TABLE shipping_methods IS 'Méthodes de livraison disponibles';
