-- Migration: Create __seo_gamme_purchase_guide table
-- Purpose: Store purchase guide content for each gamme (product family)
-- Used by: Admin interface /admin/gammes-seo/{pgId} - "Guide d'achat" tab

-- Create the purchase guide table
CREATE TABLE IF NOT EXISTS __seo_gamme_purchase_guide (
  sgpg_id SERIAL PRIMARY KEY,
  sgpg_pg_id VARCHAR(20) NOT NULL,

  -- Step 1: Compatibility / How to identify
  sgpg_step1_title VARCHAR(255) DEFAULT 'Vérifiez la compatibilité',
  sgpg_step1_content TEXT,
  sgpg_step1_highlight VARCHAR(500),
  sgpg_step1_bullets TEXT[],

  -- Step 2: Price ranges - Economique
  sgpg_eco_subtitle VARCHAR(255),
  sgpg_eco_description TEXT,
  sgpg_eco_specs TEXT[],
  sgpg_eco_price VARCHAR(50),

  -- Step 2: Price ranges - Qualité+
  sgpg_qplus_subtitle VARCHAR(255),
  sgpg_qplus_description TEXT,
  sgpg_qplus_specs TEXT[],
  sgpg_qplus_price VARCHAR(50),
  sgpg_qplus_badge VARCHAR(50) DEFAULT 'Le plus choisi',

  -- Step 2: Price ranges - Premium
  sgpg_premium_subtitle VARCHAR(255),
  sgpg_premium_description TEXT,
  sgpg_premium_specs TEXT[],
  sgpg_premium_price VARCHAR(50),

  -- Step 3: Safety and tips
  sgpg_step3_title VARCHAR(255) DEFAULT 'Sécurité et conseils',
  sgpg_step3_content TEXT,
  sgpg_step3_alerts JSONB DEFAULT '[]'::jsonb,
  sgpg_related_gammes JSONB DEFAULT '[]'::jsonb,

  -- Timestamps
  sgpg_created_at TIMESTAMP DEFAULT NOW(),
  sgpg_updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_pg_id UNIQUE(sgpg_pg_id)
);

-- Create index for faster lookups by pg_id
CREATE INDEX IF NOT EXISTS idx_purchase_guide_pg_id ON __seo_gamme_purchase_guide(sgpg_pg_id);

-- Add comments for documentation
COMMENT ON TABLE __seo_gamme_purchase_guide IS 'Purchase guide content for each product gamme (family), managed via admin interface';
COMMENT ON COLUMN __seo_gamme_purchase_guide.sgpg_pg_id IS 'Foreign key to __product_gamme.pg_id';
COMMENT ON COLUMN __seo_gamme_purchase_guide.sgpg_step1_bullets IS 'Array of bullet points for step 1';
COMMENT ON COLUMN __seo_gamme_purchase_guide.sgpg_step3_alerts IS 'JSON array of {type: danger|warning|info, text: string}';
COMMENT ON COLUMN __seo_gamme_purchase_guide.sgpg_related_gammes IS 'JSON array of {pgId, pgName, pgAlias} for related product families';

-- Insert sample data for Alternateur (pg_id=4) as pilot
INSERT INTO __seo_gamme_purchase_guide (
  sgpg_pg_id,
  sgpg_step1_title,
  sgpg_step1_content,
  sgpg_step1_highlight,
  sgpg_step1_bullets,
  sgpg_eco_subtitle,
  sgpg_eco_description,
  sgpg_eco_specs,
  sgpg_eco_price,
  sgpg_qplus_subtitle,
  sgpg_qplus_description,
  sgpg_qplus_specs,
  sgpg_qplus_price,
  sgpg_qplus_badge,
  sgpg_premium_subtitle,
  sgpg_premium_description,
  sgpg_premium_specs,
  sgpg_premium_price,
  sgpg_step3_title,
  sgpg_step3_content,
  sgpg_step3_alerts,
  sgpg_related_gammes
) VALUES (
  '4',
  'Identifiez votre alternateur',
  'Utilisez notre sélecteur par véhicule en choisissant la marque, le modèle, l''année et la motorisation. Sélectionnez ensuite selon l''ampérage (80A-150A) et le voltage (12V/14V) compatibles.',
  'Vérifiez l''ampérage et le voltage sur votre alternateur actuel',
  ARRAY['Identifiez la marque et le modèle de votre véhicule', 'Notez l''ampérage (A) inscrit sur l''étiquette de l''alternateur', 'Vérifiez le voltage (généralement 12V ou 14V)', 'Comparez avec les références OEM du constructeur'],
  'Usage standard',
  'Alternateurs reconditionnés ou de marque aftermarket. Parfaits pour un usage quotidien avec équipements électriques standards (autoradio, climatisation basique).',
  ARRAY['Type : Reconditionné/Aftermarket', 'Ampérage : 80-100A', 'Voltage : 12-14V', 'Garantie : 1 an'],
  'À partir de 89€',
  'Équipement d''origine',
  'Alternateurs de qualité équipementier d''origine (OE). Ampérage adapté aux véhicules modernes avec nombreux équipements électriques.',
  ARRAY['Type : Qualité OE', 'Ampérage : 100-120A', 'Voltage : 12-14V', 'Garantie : 2 ans'],
  'À partir de 159€',
  'Le plus choisi',
  'Haute performance',
  'Alternateurs premium haute performance. Pour véhicules avec nombreux consommateurs (GPS, caméras, systèmes audio haut de gamme, accessoires 12V).',
  ARRAY['Type : Premium/OEM', 'Ampérage : 120-150A+', 'Voltage : 12-14V régulé', 'Garantie : 3 ans'],
  'À partir de 249€',
  'Installation et précautions',
  'L''alternateur est entraîné par la courroie d''accessoires. Lors du remplacement, vérifiez l''état de la courroie et du galet tendeur. Déconnectez toujours la batterie avant intervention.',
  '[{"type": "danger", "text": "Déconnectez la borne négative de la batterie avant démontage"}, {"type": "warning", "text": "Signes d''usure : témoin batterie allumé, batterie qui se décharge, bruits de roulement"}, {"type": "info", "text": "Vérifiez la courroie d''accessoires et le galet tendeur lors du remplacement"}]'::jsonb,
  '[{"pgId": 7, "pgName": "Courroie accessoires", "pgAlias": "courroie-accessoires"}, {"pgId": 11, "pgName": "Galet tendeur", "pgAlias": "galet-tendeur"}, {"pgId": 9, "pgName": "Démarreur", "pgAlias": "demarreur"}]'::jsonb
) ON CONFLICT (sgpg_pg_id) DO NOTHING;

-- Insert sample data for Plaquettes de frein (pg_id=1)
INSERT INTO __seo_gamme_purchase_guide (
  sgpg_pg_id,
  sgpg_step1_title,
  sgpg_step1_content,
  sgpg_step1_highlight,
  sgpg_step1_bullets,
  sgpg_eco_subtitle,
  sgpg_eco_description,
  sgpg_eco_specs,
  sgpg_eco_price,
  sgpg_qplus_subtitle,
  sgpg_qplus_description,
  sgpg_qplus_specs,
  sgpg_qplus_price,
  sgpg_qplus_badge,
  sgpg_premium_subtitle,
  sgpg_premium_description,
  sgpg_premium_specs,
  sgpg_premium_price,
  sgpg_step3_title,
  sgpg_step3_content,
  sgpg_step3_alerts,
  sgpg_related_gammes
) VALUES (
  '1',
  'Identifiez vos plaquettes',
  'Sélectionnez votre véhicule (marque, modèle, année, motorisation) pour trouver les plaquettes compatibles. Les dimensions et le type de fixation varient selon l''étrier de frein.',
  'Remplacez toujours les plaquettes par essieu (avant ou arrière)',
  ARRAY['Sélectionnez votre véhicule dans notre sélecteur', 'Vérifiez le type de frein (ventilé ou plein)', 'Mesurez l''épaisseur des plaquettes actuelles', 'Comparez avec les références OEM'],
  'Usage quotidien',
  'Plaquettes économiques pour un usage urbain standard. Bonnes performances de freinage pour une conduite normale.',
  ARRAY['Type : Semi-métallique', 'Épaisseur standard', 'Usage : Ville/Route', 'Garantie : 1 an'],
  'À partir de 19€',
  'Qualité constructeur',
  'Plaquettes de qualité équipementier d''origine. Performances optimales et usure équilibrée pour tous types de conduite.',
  ARRAY['Type : Low-metallic', 'Épaisseur : OE', 'Usage : Tous types', 'Garantie : 2 ans'],
  'À partir de 35€',
  'Le plus choisi',
  'Sport et performance',
  'Plaquettes hautes performances pour conduite sportive. Excellente résistance à la chaleur et freinage puissant.',
  ARRAY['Type : Céramique/Sport', 'Épaisseur : Renforcée', 'Usage : Sport/Montagne', 'Garantie : 2 ans'],
  'À partir de 59€',
  'Remplacement sécurisé',
  'Le remplacement des plaquettes est une opération de sécurité critique. Remplacez toujours les plaquettes par paire (essieu avant ou arrière). Vérifiez l''épaisseur des disques.',
  '[{"type": "danger", "text": "Ne roulez jamais avec des plaquettes usées - risque d''accident"}, {"type": "warning", "text": "Témoin d''usure : bruit de grincement, distance de freinage allongée"}, {"type": "info", "text": "Après remplacement, effectuez un rodage sur 200km (freinages progressifs)"}]'::jsonb,
  '[{"pgId": 2, "pgName": "Disques de frein", "pgAlias": "disque-de-frein"}, {"pgId": 3, "pgName": "Kit de frein", "pgAlias": "kit-frein"}]'::jsonb
) ON CONFLICT (sgpg_pg_id) DO NOTHING;
