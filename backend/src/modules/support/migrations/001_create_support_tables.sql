-- Migration pour le module Support
-- Création des tables principales

-- Table pour les configurations du support
CREATE TABLE IF NOT EXISTS support_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table pour les tickets de contact
CREATE TABLE IF NOT EXISTS support_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID,
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50),
  subject VARCHAR(500) NOT NULL,
  message TEXT NOT NULL,
  priority VARCHAR(20) DEFAULT 'normal',
  category VARCHAR(50) DEFAULT 'general',
  status VARCHAR(20) DEFAULT 'open',
  assigned_to UUID,
  attachments JSONB DEFAULT '[]',
  tags JSONB DEFAULT '[]',
  satisfaction JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);

-- Table pour les réponses aux tickets
CREATE TABLE IF NOT EXISTS support_contact_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES support_contacts(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  author VARCHAR(255) NOT NULL,
  author_type VARCHAR(20) NOT NULL, -- 'customer' or 'staff'
  attachments JSONB DEFAULT '[]',
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Table pour les avis clients
CREATE TABLE IF NOT EXISTS support_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  order_id UUID,
  product_id UUID,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(255) NOT NULL,
  comment TEXT NOT NULL,
  images JSONB DEFAULT '[]',
  verified BOOLEAN DEFAULT FALSE,
  moderated BOOLEAN DEFAULT FALSE,
  published BOOLEAN DEFAULT FALSE,
  helpful INTEGER DEFAULT 0,
  not_helpful INTEGER DEFAULT 0,
  moderator_note TEXT,
  moderated_by UUID,
  moderated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table pour les demandes de devis
CREATE TABLE IF NOT EXISTS support_quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50),
  company_name VARCHAR(255),
  project_description TEXT NOT NULL,
  required_products JSONB NOT NULL,
  estimated_budget VARCHAR(100),
  preferred_delivery_date DATE,
  status VARCHAR(20) DEFAULT 'pending',
  priority VARCHAR(20) DEFAULT 'normal',
  attachments JSONB DEFAULT '[]',
  notes TEXT,
  assigned_to UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table pour les devis
CREATE TABLE IF NOT EXISTS support_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id UUID NOT NULL REFERENCES support_quote_requests(id) ON DELETE CASCADE,
  quoted_items JSONB NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  taxes DECIMAL(10,2) DEFAULT 0,
  shipping DECIMAL(10,2) DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  valid_until DATE NOT NULL,
  terms TEXT,
  status VARCHAR(20) DEFAULT 'draft',
  created_by UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table pour les FAQ
CREATE TABLE IF NOT EXISTS support_faq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category VARCHAR(100) NOT NULL,
  tags JSONB DEFAULT '[]',
  order_index INTEGER DEFAULT 0,
  published BOOLEAN DEFAULT TRUE,
  helpful INTEGER DEFAULT 0,
  not_helpful INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  created_by UUID NOT NULL,
  updated_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table pour les catégories FAQ
CREATE TABLE IF NOT EXISTS support_faq_categories (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(10),
  order_index INTEGER DEFAULT 0,
  published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table pour les documents légaux
CREATE TABLE IF NOT EXISTS support_legal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  version VARCHAR(20) NOT NULL,
  effective_date DATE NOT NULL,
  published BOOLEAN DEFAULT FALSE,
  language VARCHAR(10) DEFAULT 'fr',
  slug VARCHAR(255) NOT NULL UNIQUE,
  metadata JSONB DEFAULT '{}',
  created_by UUID NOT NULL,
  updated_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table pour les versions des documents légaux
CREATE TABLE IF NOT EXISTS support_legal_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES support_legal_documents(id) ON DELETE CASCADE,
  version VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  changes TEXT,
  effective_date DATE NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table pour les acceptations de documents légaux
CREATE TABLE IF NOT EXISTS support_legal_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  document_id UUID NOT NULL REFERENCES support_legal_documents(id) ON DELETE CASCADE,
  document_version VARCHAR(20) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  accepted_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, document_id, document_version)
);

-- Table pour les réclamations
CREATE TABLE IF NOT EXISTS support_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50),
  order_id UUID,
  product_id UUID,
  type VARCHAR(50) NOT NULL,
  priority VARCHAR(20) DEFAULT 'normal',
  status VARCHAR(20) DEFAULT 'open',
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  expected_resolution TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  assigned_to UUID,
  resolution JSONB,
  satisfaction JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  escalated_at TIMESTAMP
);

-- Table pour la timeline des réclamations
CREATE TABLE IF NOT EXISTS support_claim_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES support_claims(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  performed_by UUID NOT NULL,
  visibility VARCHAR(20) DEFAULT 'both', -- 'internal', 'customer', 'both'
  attachments JSONB DEFAULT '[]',
  performed_at TIMESTAMP DEFAULT NOW()
);

-- Table pour les notifications
CREATE TABLE IF NOT EXISTS support_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  priority VARCHAR(20) DEFAULT 'normal',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  user_id UUID,
  staff_id UUID,
  metadata JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  sent BOOLEAN DEFAULT FALSE,
  channels JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  sent_at TIMESTAMP,
  read_at TIMESTAMP
);

-- Table pour les templates de notification
CREATE TABLE IF NOT EXISTS support_notification_templates (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  channels JSONB DEFAULT '[]',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table pour les événements d'audit
CREATE TABLE IF NOT EXISTS support_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(100) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  user_id UUID,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_support_contacts_status ON support_contacts(status);
CREATE INDEX IF NOT EXISTS idx_support_contacts_assigned ON support_contacts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_contacts_created ON support_contacts(created_at);
CREATE INDEX IF NOT EXISTS idx_support_contacts_customer ON support_contacts(customer_email);

CREATE INDEX IF NOT EXISTS idx_support_reviews_product ON support_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_support_reviews_customer ON support_reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_support_reviews_published ON support_reviews(published);
CREATE INDEX IF NOT EXISTS idx_support_reviews_rating ON support_reviews(rating);

CREATE INDEX IF NOT EXISTS idx_support_quotes_request ON support_quotes(quote_request_id);
CREATE INDEX IF NOT EXISTS idx_support_quotes_status ON support_quotes(status);

CREATE INDEX IF NOT EXISTS idx_support_faq_category ON support_faq(category);
CREATE INDEX IF NOT EXISTS idx_support_faq_published ON support_faq(published);

CREATE INDEX IF NOT EXISTS idx_support_legal_type ON support_legal_documents(type);
CREATE INDEX IF NOT EXISTS idx_support_legal_published ON support_legal_documents(published);
CREATE INDEX IF NOT EXISTS idx_support_legal_slug ON support_legal_documents(slug);

CREATE INDEX IF NOT EXISTS idx_support_claims_status ON support_claims(status);
CREATE INDEX IF NOT EXISTS idx_support_claims_customer ON support_claims(customer_id);
CREATE INDEX IF NOT EXISTS idx_support_claims_assigned ON support_claims(assigned_to);

CREATE INDEX IF NOT EXISTS idx_support_notifications_user ON support_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_support_notifications_staff ON support_notifications(staff_id);
CREATE INDEX IF NOT EXISTS idx_support_notifications_read ON support_notifications(read);

CREATE INDEX IF NOT EXISTS idx_support_audit_entity ON support_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_support_audit_user ON support_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_support_audit_created ON support_audit_logs(created_at);

-- Triggers pour mise à jour automatique des timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_support_contacts_updated_at BEFORE UPDATE ON support_contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_support_reviews_updated_at BEFORE UPDATE ON support_reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_support_quote_requests_updated_at BEFORE UPDATE ON support_quote_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_support_faq_updated_at BEFORE UPDATE ON support_faq FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_support_legal_documents_updated_at BEFORE UPDATE ON support_legal_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_support_claims_updated_at BEFORE UPDATE ON support_claims FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Données initiales pour les catégories FAQ
INSERT INTO support_faq_categories (id, name, description, icon, order_index) VALUES
('orders', 'Commandes', 'Questions sur le processus de commande', '📦', 1),
('shipping', 'Livraison', 'Informations sur la livraison', '🚚', 2),
('returns', 'Retours', 'Politique de retour et échange', '↩️', 3),
('payment', 'Paiement', 'Méthodes de paiement et facturation', '💳', 4),
('technical', 'Support technique', 'Aide technique et installation', '🔧', 5),
('account', 'Compte client', 'Gestion de votre compte', '👤', 6)
ON CONFLICT (id) DO NOTHING;

-- Templates de notification par défaut
INSERT INTO support_notification_templates (id, name, subject, body, variables, channels) VALUES
('contact_received', 'Contact Form Received', 'Nouveau message de contact reçu', 'Un nouveau message de contact a été reçu de {{customerName}} ({{email}}).', '["customerName", "email", "subject", "message"]', '["email"]'),
('quote_requested', 'Quote Requested', 'Nouvelle demande de devis', 'Une nouvelle demande de devis a été soumise par {{customerName}}.', '["customerName", "products", "estimatedBudget"]', '["email"]'),
('review_submitted', 'Review Submitted', 'Nouvel avis client', 'Un nouvel avis a été soumis par {{customerName}}.', '["customerName", "rating", "comment"]', '["email"]'),
('claim_opened', 'Claim Opened', 'Nouvelle réclamation ouverte', 'Une nouvelle réclamation a été ouverte par {{customerName}}.', '["customerName", "orderId", "reason"]', '["email"]'),
('auto_response', 'Auto Response', 'Confirmation de réception', 'Bonjour {{customerName}}, nous avons bien reçu votre message.', '["customerName", "responseTime"]', '["email"]')
ON CONFLICT (id) DO NOTHING;

-- Configuration par défaut
INSERT INTO support_config (key, value, description) VALUES
('business_hours', '{"start": "09:00", "end": "17:00", "timezone": "Europe/Paris", "workdays": ["monday", "tuesday", "wednesday", "thursday", "friday"]}', 'Heures d''ouverture du support'),
('response_times', '{"urgent": 15, "high": 60, "normal": 240, "low": 1440}', 'Temps de réponse SLA en minutes'),
('file_upload', '{"maxSize": 10485760, "allowedTypes": ["image/jpeg", "image/png", "application/pdf", "text/plain"], "maxFiles": 5}', 'Configuration upload de fichiers'),
('notifications', '{"emailEnabled": true, "smsEnabled": false, "pushEnabled": true}', 'Paramètres de notification')
ON CONFLICT (key) DO NOTHING;
