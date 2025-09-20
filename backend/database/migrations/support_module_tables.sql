-- Migration pour le module Support - Tables des contacts et réponses
-- Créé le: $(date)
-- Version: 1.0

-- Table principale des tickets de support
CREATE TABLE IF NOT EXISTS support_contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_number VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    subject VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
    category VARCHAR(50) NOT NULL CHECK (category IN ('general', 'technical', 'billing', 'complaint', 'suggestion')),
    status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed')),
    assigned_to VARCHAR(255),
    tags TEXT[] DEFAULT '{}',
    attachments TEXT[] DEFAULT '{}',
    vehicle_info JSONB,
    order_number VARCHAR(100),
    satisfaction JSONB,
    estimated_response_time TIMESTAMPTZ,
    escalated BOOLEAN DEFAULT FALSE,
    escalation_reason TEXT,
    internal_notes TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des réponses aux tickets
CREATE TABLE IF NOT EXISTS support_contact_responses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id UUID NOT NULL REFERENCES support_contacts(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    author VARCHAR(255) NOT NULL,
    author_type VARCHAR(20) NOT NULL CHECK (author_type IN ('customer', 'staff')),
    attachments TEXT[] DEFAULT '{}',
    is_internal BOOLEAN DEFAULT FALSE,
    response_time INTEGER, -- En minutes
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_support_contacts_status ON support_contacts(status);
CREATE INDEX IF NOT EXISTS idx_support_contacts_priority ON support_contacts(priority);
CREATE INDEX IF NOT EXISTS idx_support_contacts_category ON support_contacts(category);
CREATE INDEX IF NOT EXISTS idx_support_contacts_assigned_to ON support_contacts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_contacts_email ON support_contacts(email);
CREATE INDEX IF NOT EXISTS idx_support_contacts_created_at ON support_contacts(created_at);
CREATE INDEX IF NOT EXISTS idx_support_contacts_ticket_number ON support_contacts(ticket_number);
CREATE INDEX IF NOT EXISTS idx_support_contacts_escalated ON support_contacts(escalated);

CREATE INDEX IF NOT EXISTS idx_support_responses_ticket_id ON support_contact_responses(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_responses_author_type ON support_contact_responses(author_type);
CREATE INDEX IF NOT EXISTS idx_support_responses_created_at ON support_contact_responses(created_at);

-- Trigger pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_support_contact_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_update_support_contact_updated_at ON support_contacts;
CREATE TRIGGER trigger_update_support_contact_updated_at
    BEFORE UPDATE ON support_contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_support_contact_updated_at();

-- Ajout de quelques commentaires pour la documentation
COMMENT ON TABLE support_contacts IS 'Table principale des tickets de support client';
COMMENT ON COLUMN support_contacts.ticket_number IS 'Numéro unique du ticket (ex: CT-ABC123-XYZ)';
COMMENT ON COLUMN support_contacts.priority IS 'Priorité du ticket: urgent, high, normal, low';
COMMENT ON COLUMN support_contacts.category IS 'Catégorie: general, technical, billing, complaint, suggestion';
COMMENT ON COLUMN support_contacts.status IS 'Statut: open, in_progress, waiting_customer, resolved, closed';
COMMENT ON COLUMN support_contacts.vehicle_info IS 'Informations sur le véhicule (JSON)';
COMMENT ON COLUMN support_contacts.satisfaction IS 'Évaluation de satisfaction client (JSON)';
COMMENT ON COLUMN support_contacts.tags IS 'Tags automatiques et manuels';

COMMENT ON TABLE support_contact_responses IS 'Réponses et communications pour chaque ticket';
COMMENT ON COLUMN support_contact_responses.author_type IS 'Type d\'auteur: customer ou staff';
COMMENT ON COLUMN support_contact_responses.is_internal IS 'True si c\'est une note interne';
COMMENT ON COLUMN support_contact_responses.response_time IS 'Temps de réponse en minutes depuis la dernière interaction';

-- Politiques de sécurité RLS (Row Level Security)
ALTER TABLE support_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_contact_responses ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre à tous les utilisateurs authentifiés de lire/écrire
CREATE POLICY "Authenticated users can manage support tickets" ON support_contacts
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage support responses" ON support_contact_responses
    FOR ALL USING (auth.role() = 'authenticated');

-- Vue pour les statistiques rapides
CREATE OR REPLACE VIEW support_stats_overview AS
SELECT 
    COUNT(*) as total_tickets,
    COUNT(*) FILTER (WHERE status = 'open') as open_tickets,
    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_tickets,
    COUNT(*) FILTER (WHERE status = 'resolved') as resolved_tickets,
    COUNT(*) FILTER (WHERE status = 'closed') as closed_tickets,
    COUNT(*) FILTER (WHERE escalated = true) as escalated_tickets,
    ROUND(AVG((satisfaction->>'rating')::numeric), 2) as avg_satisfaction,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as tickets_last_24h,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as tickets_last_week
FROM support_contacts;

COMMENT ON VIEW support_stats_overview IS 'Vue pour les statistiques globales du support';
