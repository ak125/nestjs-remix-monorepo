-- Script SQL pour créer les tables de paiement dans Supabase
-- Compatible PostgreSQL avec noms de tables en minuscules

-- Table principale des paiements
CREATE TABLE IF NOT EXISTS payment (
    pay_id VARCHAR(50) PRIMARY KEY,
    pay_ord_id VARCHAR(50) NOT NULL, -- Référence à la commande
    pay_cst_id VARCHAR(50) NOT NULL, -- Référence au client
    
    -- Informations de paiement
    pay_amount DECIMAL(10, 2) NOT NULL,
    pay_currency VARCHAR(3) DEFAULT 'EUR',
    pay_gateway VARCHAR(20) NOT NULL, -- CYBERPLUS, STRIPE, PAYPAL, BANK_TRANSFER
    pay_status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, PAID, FAILED, REFUNDED, SUCCESS, CANCELLED
    
    -- Références externes
    pay_transaction_id VARCHAR(100) UNIQUE,
    pay_bank_reference VARCHAR(100),
    
    -- URLs et métadonnées
    pay_return_url TEXT,
    pay_cancel_url TEXT,
    pay_callback_url TEXT,
    pay_metadata JSONB,
    
    -- Dates
    pay_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    pay_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    pay_paid_at TIMESTAMP,
    
    -- Index pour améliorer les performances
    CONSTRAINT fk_payment_order FOREIGN KEY (pay_ord_id) REFERENCES ___xtr_order(ord_id) ON DELETE CASCADE,
    CONSTRAINT fk_payment_customer FOREIGN KEY (pay_cst_id) REFERENCES ___xtr_customer(cst_id) ON DELETE CASCADE
);

-- Table des logs de paiement pour audit
CREATE TABLE IF NOT EXISTS payment_log (
    log_id SERIAL PRIMARY KEY,
    log_pay_id VARCHAR(50), -- Peut être NULL pour les callbacks non associés
    
    -- Action et données
    log_action VARCHAR(50) NOT NULL, -- PAYMENT_INITIATED, PAYMENT_SUCCESS, etc.
    log_data JSONB,
    
    -- Informations de contexte
    log_ip_address INET,
    log_user_agent TEXT,
    
    -- Date
    log_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Contrainte de clé étrangère
    CONSTRAINT fk_payment_log_payment FOREIGN KEY (log_pay_id) REFERENCES payment(pay_id) ON DELETE CASCADE
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_payment_ord_id ON payment(pay_ord_id);
CREATE INDEX IF NOT EXISTS idx_payment_cst_id ON payment(pay_cst_id);
CREATE INDEX IF NOT EXISTS idx_payment_status ON payment(pay_status);
CREATE INDEX IF NOT EXISTS idx_payment_transaction_id ON payment(pay_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_created_at ON payment(pay_created_at);

CREATE INDEX IF NOT EXISTS idx_payment_log_pay_id ON payment_log(log_pay_id);
CREATE INDEX IF NOT EXISTS idx_payment_log_action ON payment_log(log_action);
CREATE INDEX IF NOT EXISTS idx_payment_log_created_at ON payment_log(log_created_at);

-- Trigger pour mettre à jour automatiquement pay_updated_at
CREATE OR REPLACE FUNCTION update_payment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.pay_updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_payment_updated_at
    BEFORE UPDATE ON payment
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_updated_at();

-- Commentaires pour documentation
COMMENT ON TABLE payment IS 'Table principale des paiements - Compatible avec système legacy';
COMMENT ON COLUMN payment.pay_id IS 'Identifiant unique du paiement (format: pay_timestamp_random)';
COMMENT ON COLUMN payment.pay_ord_id IS 'Référence à la commande (ord_id de ___xtr_order)';
COMMENT ON COLUMN payment.pay_cst_id IS 'Référence au client (cst_id de ___xtr_customer)';
COMMENT ON COLUMN payment.pay_amount IS 'Montant du paiement en euros';
COMMENT ON COLUMN payment.pay_gateway IS 'Gateway de paiement utilisée';
COMMENT ON COLUMN payment.pay_status IS 'Statut actuel du paiement';
COMMENT ON COLUMN payment.pay_transaction_id IS 'ID de transaction de la gateway';
COMMENT ON COLUMN payment.pay_metadata IS 'Métadonnées additionnelles au format JSON';

COMMENT ON TABLE payment_log IS 'Logs d\'audit pour tous les événements de paiement';
COMMENT ON COLUMN payment_log.log_action IS 'Type d\'action effectuée';
COMMENT ON COLUMN payment_log.log_data IS 'Données associées à l\'action au format JSON';
COMMENT ON COLUMN payment_log.log_ip_address IS 'Adresse IP de l\'origine de l\'action';

-- Données de test (optionnel)
-- INSERT INTO payment (pay_id, pay_ord_id, pay_cst_id, pay_amount, pay_gateway, pay_status) VALUES
-- ('pay_test_001', 'ord_test_001', 'cst_test_001', 99.99, 'CYBERPLUS', 'PENDING');

-- Vérification des tables créées
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('payment', 'payment_log')
ORDER BY table_name, ordinal_position;
