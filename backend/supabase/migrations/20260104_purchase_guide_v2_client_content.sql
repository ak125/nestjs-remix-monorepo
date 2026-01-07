-- Migration: Purchase Guide V2 - Structure orientée client
-- Crée la table avec la nouvelle structure narrative (pas de specs/gammes de prix)

-- ============================================
-- ÉTAPE 0: Supprimer l'ancienne table V1 si elle existe
-- ============================================
-- IMPORTANT: L'ancienne structure (step1/step2/step3/eco/qplus/premium)
-- n'est pas compatible avec la nouvelle structure V2 (intro/risk/timing/arguments)
DROP TABLE IF EXISTS __seo_gamme_purchase_guide;

-- ============================================
-- ÉTAPE 1: Créer la table avec structure V2
-- ============================================

CREATE TABLE __seo_gamme_purchase_guide (
  sgpg_id SERIAL PRIMARY KEY,
  sgpg_pg_id VARCHAR(20) NOT NULL,

  -- Section 1: À quoi ça sert
  sgpg_intro_title VARCHAR(255),
  sgpg_intro_role TEXT,
  sgpg_intro_sync_parts TEXT[],

  -- Section 2: Pourquoi c'est critique (réduction de la peur)
  sgpg_risk_title VARCHAR(255),
  sgpg_risk_explanation TEXT,
  sgpg_risk_consequences TEXT[],
  sgpg_risk_cost_range VARCHAR(100),
  sgpg_risk_conclusion TEXT,

  -- Section 3: Quand changer
  sgpg_timing_title VARCHAR(255),
  sgpg_timing_years VARCHAR(50),
  sgpg_timing_km VARCHAR(50),
  sgpg_timing_note TEXT,

  -- Section 4: Pourquoi acheter chez nous (4 arguments)
  sgpg_arg1_title VARCHAR(255),
  sgpg_arg1_content TEXT,
  sgpg_arg2_title VARCHAR(255),
  sgpg_arg2_content TEXT,
  sgpg_arg3_title VARCHAR(255),
  sgpg_arg3_content TEXT,
  sgpg_arg4_title VARCHAR(255),
  sgpg_arg4_content TEXT,

  -- Timestamps
  sgpg_created_at TIMESTAMP DEFAULT NOW(),
  sgpg_updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_pg_id UNIQUE(sgpg_pg_id)
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_purchase_guide_pg_id ON __seo_gamme_purchase_guide(sgpg_pg_id);

-- ============================================
-- ÉTAPE 2: Commentaires documentation
-- ============================================

COMMENT ON TABLE __seo_gamme_purchase_guide IS 'Guide d''achat V2 orienté client - structure narrative';
COMMENT ON COLUMN __seo_gamme_purchase_guide.sgpg_pg_id IS 'Foreign key vers __product_gamme.pg_id';

COMMENT ON COLUMN __seo_gamme_purchase_guide.sgpg_intro_title IS 'Section 1: Nom de la pièce';
COMMENT ON COLUMN __seo_gamme_purchase_guide.sgpg_intro_role IS 'Section 1: Rôle de la pièce (langage simple)';
COMMENT ON COLUMN __seo_gamme_purchase_guide.sgpg_intro_sync_parts IS 'Section 1: Éléments synchronisés (array)';

COMMENT ON COLUMN __seo_gamme_purchase_guide.sgpg_risk_title IS 'Section 2: Titre (ex: Pourquoi ne jamais attendre)';
COMMENT ON COLUMN __seo_gamme_purchase_guide.sgpg_risk_explanation IS 'Section 2: Explication du risque';
COMMENT ON COLUMN __seo_gamme_purchase_guide.sgpg_risk_consequences IS 'Section 2: Conséquences si casse (array)';
COMMENT ON COLUMN __seo_gamme_purchase_guide.sgpg_risk_cost_range IS 'Section 2: Fourchette coût réparation';
COMMENT ON COLUMN __seo_gamme_purchase_guide.sgpg_risk_conclusion IS 'Section 2: Message rassurant';

COMMENT ON COLUMN __seo_gamme_purchase_guide.sgpg_timing_title IS 'Section 3: Titre (ex: Quand changer)';
COMMENT ON COLUMN __seo_gamme_purchase_guide.sgpg_timing_years IS 'Section 3: Intervalle années';
COMMENT ON COLUMN __seo_gamme_purchase_guide.sgpg_timing_km IS 'Section 3: Intervalle km';
COMMENT ON COLUMN __seo_gamme_purchase_guide.sgpg_timing_note IS 'Section 3: Note importante';

COMMENT ON COLUMN __seo_gamme_purchase_guide.sgpg_arg1_title IS 'Section 4 Arg1: Titre';
COMMENT ON COLUMN __seo_gamme_purchase_guide.sgpg_arg1_content IS 'Section 4 Arg1: Contenu';
COMMENT ON COLUMN __seo_gamme_purchase_guide.sgpg_arg2_title IS 'Section 4 Arg2: Titre';
COMMENT ON COLUMN __seo_gamme_purchase_guide.sgpg_arg2_content IS 'Section 4 Arg2: Contenu';
COMMENT ON COLUMN __seo_gamme_purchase_guide.sgpg_arg3_title IS 'Section 4 Arg3: Titre';
COMMENT ON COLUMN __seo_gamme_purchase_guide.sgpg_arg3_content IS 'Section 4 Arg3: Contenu';
COMMENT ON COLUMN __seo_gamme_purchase_guide.sgpg_arg4_title IS 'Section 4 Arg4: Titre';
COMMENT ON COLUMN __seo_gamme_purchase_guide.sgpg_arg4_content IS 'Section 4 Arg4: Contenu';

-- ============================================
-- ÉTAPE 3: Exemple - Courroie de distribution
-- ============================================

INSERT INTO __seo_gamme_purchase_guide (
  sgpg_pg_id,
  sgpg_intro_title,
  sgpg_intro_role,
  sgpg_intro_sync_parts,
  sgpg_risk_title,
  sgpg_risk_explanation,
  sgpg_risk_consequences,
  sgpg_risk_cost_range,
  sgpg_risk_conclusion,
  sgpg_timing_title,
  sgpg_timing_years,
  sgpg_timing_km,
  sgpg_timing_note,
  sgpg_arg1_title,
  sgpg_arg1_content,
  sgpg_arg2_title,
  sgpg_arg2_content,
  sgpg_arg3_title,
  sgpg_arg3_content,
  sgpg_arg4_title,
  sgpg_arg4_content
) VALUES (
  '8',
  'La courroie de distribution',
  'La courroie de distribution est une pièce essentielle du moteur. Elle synchronise parfaitement plusieurs éléments clés. Sans elle, le moteur ne peut pas fonctionner correctement.',
  ARRAY['le vilebrequin', 'l''arbre à cames', 'parfois la pompe à eau'],
  'Pourquoi ne jamais attendre pour la remplacer ?',
  'Avec le temps, la courroie s''use sans prévenir. Et contrairement à d''autres pièces, elle ne donne pas de signes avant de casser.',
  ARRAY['le moteur peut être gravement endommagé', 'les réparations peuvent dépasser 2 000 à 5 000 €', 'parfois, le moteur est irrécupérable'],
  '2 000 à 5 000 €',
  'Changer la courroie à temps coûte beaucoup moins cher qu''une panne.',
  'Quand faut-il la changer ?',
  '5 à 7 ans',
  '60 000 à 160 000 km',
  'Cela dépend exactement du moteur → d''où l''importance de choisir la bonne courroie.',
  'Compatibilité garantie',
  'Sur notre site, vous sélectionnez votre véhicule (marque, modèle, motorisation). La pièce est 100 % compatible, sans erreur possible.',
  'Qualité équivalente à l''origine',
  'Nous proposons des marques reconnues, des pièces conformes aux normes constructeur, la même qualité que chez un concessionnaire.',
  'Prix plus juste',
  'Jusqu''à 40 % moins cher qu''en garage ou concession, sans compromis sur la fiabilité.',
  'Kit complet recommandé',
  'Nous conseillons le kit de distribution complet : courroie, galets, parfois pompe à eau. C''est plus sûr, plus durable, et évite une nouvelle main-d''œuvre plus tard.'
) ON CONFLICT (sgpg_pg_id) DO UPDATE SET
  sgpg_intro_title = EXCLUDED.sgpg_intro_title,
  sgpg_intro_role = EXCLUDED.sgpg_intro_role,
  sgpg_intro_sync_parts = EXCLUDED.sgpg_intro_sync_parts,
  sgpg_risk_title = EXCLUDED.sgpg_risk_title,
  sgpg_risk_explanation = EXCLUDED.sgpg_risk_explanation,
  sgpg_risk_consequences = EXCLUDED.sgpg_risk_consequences,
  sgpg_risk_cost_range = EXCLUDED.sgpg_risk_cost_range,
  sgpg_risk_conclusion = EXCLUDED.sgpg_risk_conclusion,
  sgpg_timing_title = EXCLUDED.sgpg_timing_title,
  sgpg_timing_years = EXCLUDED.sgpg_timing_years,
  sgpg_timing_km = EXCLUDED.sgpg_timing_km,
  sgpg_timing_note = EXCLUDED.sgpg_timing_note,
  sgpg_arg1_title = EXCLUDED.sgpg_arg1_title,
  sgpg_arg1_content = EXCLUDED.sgpg_arg1_content,
  sgpg_arg2_title = EXCLUDED.sgpg_arg2_title,
  sgpg_arg2_content = EXCLUDED.sgpg_arg2_content,
  sgpg_arg3_title = EXCLUDED.sgpg_arg3_title,
  sgpg_arg3_content = EXCLUDED.sgpg_arg3_content,
  sgpg_arg4_title = EXCLUDED.sgpg_arg4_title,
  sgpg_arg4_content = EXCLUDED.sgpg_arg4_content,
  sgpg_updated_at = NOW();
