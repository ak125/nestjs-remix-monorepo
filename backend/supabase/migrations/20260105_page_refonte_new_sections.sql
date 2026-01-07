-- Migration: Ajout des nouvelles colonnes pour la refonte page gamme
-- Date: 2026-01-05
-- Description: Ajoute h1_override, how_to_choose, symptoms[], faq JSONB

-- Ajouter nouvelles colonnes pour les sections manquantes
ALTER TABLE __seo_gamme_purchase_guide
ADD COLUMN IF NOT EXISTS sgpg_h1_override VARCHAR(255),
ADD COLUMN IF NOT EXISTS sgpg_how_to_choose TEXT,
ADD COLUMN IF NOT EXISTS sgpg_symptoms TEXT[],
ADD COLUMN IF NOT EXISTS sgpg_faq JSONB;

-- Commentaires pour documentation
COMMENT ON COLUMN __seo_gamme_purchase_guide.sgpg_h1_override IS 'H1 personnalisé sans "pas cher" répétitif - max 70 caractères';
COMMENT ON COLUMN __seo_gamme_purchase_guide.sgpg_how_to_choose IS 'Section "Comment choisir la bonne pièce" - matériaux, qualité OE, conduite';
COMMENT ON COLUMN __seo_gamme_purchase_guide.sgpg_symptoms IS 'Symptômes d''usure: bruits, vibrations, voyants (array de texte)';
COMMENT ON COLUMN __seo_gamme_purchase_guide.sgpg_faq IS 'FAQ au format [{question: string, answer: string}] pour schema.org';

-- Index pour améliorer les performances de requête sur les nouvelles colonnes
CREATE INDEX IF NOT EXISTS idx_sgpg_h1_override ON __seo_gamme_purchase_guide(sgpg_h1_override) WHERE sgpg_h1_override IS NOT NULL;
