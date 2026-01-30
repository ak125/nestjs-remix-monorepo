-- ============================================
-- PHASE 6: Table SEO pour pages R5 Diagnostic
-- Observable Pro (Symptom / Sign / DTC)
-- ============================================

-- ============================================
-- 1. TABLE PRINCIPALE __seo_observable
-- ============================================

CREATE TABLE IF NOT EXISTS __seo_observable (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(255) NOT NULL UNIQUE,

  -- Métadonnées SEO
  title VARCHAR(255) NOT NULL,
  meta_description VARCHAR(320),
  canonical_url VARCHAR(512),
  page_role seo_page_role DEFAULT 'R5',

  -- Classification Observable (3 niveaux de fiabilité)
  observable_type VARCHAR(20) CHECK (observable_type IN ('symptom', 'sign', 'dtc')),
  -- symptom = 60% confidence (ressenti client)
  -- sign = 85% confidence (observation technicien)
  -- dtc = 95% confidence (code OBD-II)

  -- Canal de perception (6 types)
  perception_channel VARCHAR(20) CHECK (perception_channel IN (
    'visual',       -- Fumée, fuite, voyant
    'auditory',     -- Bruit, claquement, sifflement
    'olfactory',    -- Odeur brûlée, essence
    'tactile',      -- Vibrations, à-coups, volant dur
    'electronic',   -- DTC, valise OBD
    'performance'   -- Perte puissance, consommation
  )),

  -- Niveau de risque
  risk_level VARCHAR(20) CHECK (risk_level IN ('confort', 'securite', 'critique')),

  -- Safety Gate (Phase 10)
  safety_gate VARCHAR(20) DEFAULT 'none' CHECK (safety_gate IN ('none', 'warning', 'stop_soon', 'stop_immediate')),

  -- Contenu structuré en 3 sections
  symptom_description TEXT,        -- Ce que le client ressent (Symptom)
  sign_description TEXT,           -- Ce qu'un technicien peut voir (Sign)
  dtc_codes TEXT[],                -- Codes OBD associés (P0300, C1234...)
  dtc_descriptions JSONB,          -- {"P0300": "Ratés d'allumage détectés"}

  -- Contextes normalisés (alignés avec kg.types.ts)
  ctx_phase TEXT[],                -- ['demarrage', 'acceleration', 'freinage', ...]
  ctx_temp TEXT[],                 -- ['froid', 'chaud']
  ctx_speed TEXT[],                -- ['0_30', '30_70', '70_110', '110_plus']
  ctx_road TEXT[],                 -- ['lisse', 'degradee', 'pluie', 'neige']
  ctx_load TEXT[],                 -- ['seul', 'charge', 'montee', 'descente']
  ctx_freq TEXT,                   -- 'intermittent', 'permanent', 'progressif', 'sporadique'

  -- Relations avec Knowledge Graph
  kg_observable_ids TEXT[],        -- IDs des nodes Observable dans le KG
  fault_ids TEXT[],                -- IDs des Faults associés
  action_ids TEXT[],               -- IDs des Actions recommandées

  -- Relations avec autres entités SEO
  related_gammes INTEGER[],        -- pg_ids des gammes de pièces liées
  related_references TEXT[],       -- Slugs des pages R4 liées
  related_blog_articles TEXT[],    -- Slugs des articles R3 liés

  -- Actions recommandées (résumé pour affichage)
  recommended_actions JSONB,       -- [{action: "Vérifier", urgency: "immediate", skill: "diy"}]

  -- Estimation coûts (pour affichage)
  estimated_repair_cost_min INTEGER,
  estimated_repair_cost_max INTEGER,
  estimated_repair_duration TEXT,  -- "1h", "2h", "1j"

  -- Cluster SEO
  cluster_id VARCHAR(100),         -- Ex: "embrayage", "freinage", "moteur"

  -- Priorité et visibilité
  priority INTEGER DEFAULT 50,     -- 0-100, pour classement dans index
  is_published BOOLEAN DEFAULT true,
  publish_date TIMESTAMPTZ DEFAULT NOW(),

  -- Schema.org (JSON-LD)
  schema_org JSONB,                -- JSON-LD complet pour la page

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(100),
  updated_by VARCHAR(100)
);

-- ============================================
-- 2. INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_seo_observable_slug ON __seo_observable(slug);
CREATE INDEX IF NOT EXISTS idx_seo_observable_type ON __seo_observable(observable_type);
CREATE INDEX IF NOT EXISTS idx_seo_observable_channel ON __seo_observable(perception_channel);
CREATE INDEX IF NOT EXISTS idx_seo_observable_cluster ON __seo_observable(cluster_id);
CREATE INDEX IF NOT EXISTS idx_seo_observable_risk ON __seo_observable(risk_level);
CREATE INDEX IF NOT EXISTS idx_seo_observable_safety ON __seo_observable(safety_gate);
CREATE INDEX IF NOT EXISTS idx_seo_observable_published ON __seo_observable(is_published, publish_date);

-- GIN index pour recherche dans les DTC codes
CREATE INDEX IF NOT EXISTS idx_seo_observable_dtc_gin ON __seo_observable USING GIN(dtc_codes);

-- GIN index pour recherche dans les contextes
CREATE INDEX IF NOT EXISTS idx_seo_observable_ctx_phase_gin ON __seo_observable USING GIN(ctx_phase);

-- ============================================
-- 3. TRIGGER AUTO-UPDATE updated_at
-- ============================================

CREATE OR REPLACE FUNCTION __seo_observable_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_seo_observable_updated_at ON __seo_observable;
CREATE TRIGGER trg_seo_observable_updated_at
  BEFORE UPDATE ON __seo_observable
  FOR EACH ROW
  EXECUTE FUNCTION __seo_observable_updated_at();

-- ============================================
-- 4. RPC FUNCTIONS
-- ============================================

-- Récupérer une page R5 par slug
CREATE OR REPLACE FUNCTION get_seo_observable_by_slug(p_slug TEXT)
RETURNS SETOF __seo_observable
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM __seo_observable
  WHERE slug = p_slug
    AND is_published = true
  LIMIT 1;
$$;

-- Lister les pages R5 par cluster
CREATE OR REPLACE FUNCTION get_seo_observables_by_cluster(p_cluster_id TEXT, p_limit INTEGER DEFAULT 20)
RETURNS SETOF __seo_observable
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM __seo_observable
  WHERE cluster_id = p_cluster_id
    AND is_published = true
  ORDER BY
    CASE risk_level
      WHEN 'critique' THEN 1
      WHEN 'securite' THEN 2
      WHEN 'confort' THEN 3
      ELSE 4
    END,
    priority DESC
  LIMIT p_limit;
$$;

-- Rechercher par code DTC
CREATE OR REPLACE FUNCTION search_seo_observable_by_dtc(p_dtc_code TEXT)
RETURNS SETOF __seo_observable
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM __seo_observable
  WHERE dtc_codes @> ARRAY[UPPER(p_dtc_code)]
    AND is_published = true
  ORDER BY priority DESC;
$$;

-- Récupérer les diagnostics featured (populaires)
CREATE OR REPLACE FUNCTION get_seo_observable_featured(p_limit INTEGER DEFAULT 10)
RETURNS SETOF __seo_observable
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM __seo_observable
  WHERE is_published = true
  ORDER BY
    priority DESC,
    CASE risk_level
      WHEN 'critique' THEN 1
      WHEN 'securite' THEN 2
      WHEN 'confort' THEN 3
      ELSE 4
    END,
    updated_at DESC
  LIMIT p_limit;
$$;

-- Lister toutes les pages R5 pour sitemap
CREATE OR REPLACE FUNCTION get_all_seo_observables_for_sitemap()
RETURNS TABLE(
  slug VARCHAR,
  updated_at TIMESTAMPTZ,
  risk_level VARCHAR,
  safety_gate VARCHAR
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    slug,
    updated_at,
    risk_level,
    safety_gate
  FROM __seo_observable
  WHERE is_published = true
  ORDER BY
    CASE risk_level
      WHEN 'critique' THEN 1
      WHEN 'securite' THEN 2
      WHEN 'confort' THEN 3
      ELSE 4
    END,
    updated_at DESC;
$$;

-- ============================================
-- 5. CONTENU PILOTE : bruit-embrayage
-- ============================================

INSERT INTO __seo_observable (
  slug,
  title,
  meta_description,
  observable_type,
  perception_channel,
  risk_level,
  safety_gate,
  symptom_description,
  sign_description,
  dtc_codes,
  dtc_descriptions,
  ctx_phase,
  ctx_temp,
  ctx_freq,
  cluster_id,
  related_references,
  related_gammes,
  recommended_actions,
  estimated_repair_cost_min,
  estimated_repair_cost_max,
  estimated_repair_duration,
  priority,
  schema_org
) VALUES (
  'bruit-embrayage',
  'Bruit d''embrayage : diagnostic, causes et solutions',
  'Votre embrayage fait du bruit ? Symptômes, signes techniques et codes OBD pour diagnostiquer un problème d''embrayage. Causes et solutions.',
  'symptom',
  'auditory',
  'securite',
  'warning',
  -- Symptom (ce que le client ressent)
  E'**Ce que vous pouvez ressentir :**\n\n'
  '- Bruit métallique, claquement ou grincement lors de l''utilisation de la pédale d''embrayage\n'
  '- Le bruit peut apparaître pédale enfoncée, relâchée, ou pendant le passage des vitesses\n'
  '- Vibrations au niveau de la pédale\n'
  '- Sensation de "craquement" lors du point de patinage\n\n'
  '**Quand le bruit apparaît :**\n'
  '- Au démarrage à froid\n'
  '- Lors des accélérations\n'
  '- En montée ou en charge',
  -- Sign (ce qu'un technicien peut voir)
  E'**Vérifications techniques :**\n\n'
  '- **Butée d''embrayage** : Vérifier le jeu (tolérance max 1mm), détecter tout bruit de roulement\n'
  '- **Fourchette d''embrayage** : Inspecter l''état et l''axe de pivotement\n'
  '- **Volant moteur bi-masse** : Contrôler le jeu radial et le bruit à froid\n'
  '- **Disque d''embrayage** : Mesurer l''épaisseur restante, vérifier l''usure des garnitures\n'
  '- **Mécanisme de pression** : Vérifier le ressort diaphragme',
  -- DTC codes associés
  ARRAY['P0562', 'P0568', 'P0805', 'P0806'],
  -- DTC descriptions
  '{"P0562": "Tension système basse - peut indiquer problème démarrage lié à embrayage", "P0568": "Régulateur vitesse - signal frein/embrayage", "P0805": "Capteur position embrayage - circuit", "P0806": "Capteur position embrayage - plage/performance"}'::JSONB,
  -- Contextes
  ARRAY['demarrage', 'acceleration', 'freinage'],
  ARRAY['froid', 'chaud'],
  'intermittent',
  -- Cluster et relations
  'embrayage',
  ARRAY['kit-embrayage'],
  ARRAY[479], -- pg_id du kit d'embrayage
  -- Actions recommandées
  '[
    {"action": "Contrôle visuel butée et fourchette", "urgency": "soon", "skill_level": "amateur", "duration": "15min"},
    {"action": "Test routier (point de patinage)", "urgency": "soon", "skill_level": "diy", "duration": "30min"},
    {"action": "Diagnostic volant moteur bi-masse", "urgency": "scheduled", "skill_level": "professional", "duration": "1h"},
    {"action": "Remplacement kit embrayage complet", "urgency": "scheduled", "skill_level": "professional", "duration": "3h"}
  ]'::JSONB,
  -- Estimation coûts
  200,
  800,
  '3h',
  -- Priorité
  80,
  -- Schema.org
  '{
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "Diagnostiquer un bruit d''embrayage",
    "description": "Guide pour identifier les causes d''un bruit d''embrayage et les solutions possibles",
    "step": [
      {
        "@type": "HowToStep",
        "name": "Identifier le symptôme",
        "text": "Notez quand le bruit apparaît (démarrage, accélération, freinage) et sa nature (claquement, grincement, métallique)"
      },
      {
        "@type": "HowToStep",
        "name": "Vérifier la butée d''embrayage",
        "text": "Contrôlez le jeu de la butée (max 1mm) et écoutez un éventuel bruit de roulement"
      },
      {
        "@type": "HowToStep",
        "name": "Inspecter le volant moteur",
        "text": "Vérifiez le jeu radial du volant moteur bi-masse, particulièrement à froid"
      },
      {
        "@type": "HowToStep",
        "name": "Consulter un professionnel",
        "text": "Si le problème persiste, faites diagnostiquer par un professionnel pour éviter une panne"
      }
    ],
    "totalTime": "PT30M",
    "estimatedCost": {
      "@type": "MonetaryAmount",
      "currency": "EUR",
      "minValue": 200,
      "maxValue": 800
    }
  }'::JSONB
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  meta_description = EXCLUDED.meta_description,
  symptom_description = EXCLUDED.symptom_description,
  sign_description = EXCLUDED.sign_description,
  updated_at = NOW();

-- ============================================
-- 6. MISE À JOUR URL MAPPING (assign_page_role_from_url)
-- ============================================

-- Ajouter les patterns R5 à la fonction existante si elle existe
DO $$
BEGIN
  -- Vérifier si la fonction existe et la mettre à jour pour inclure R5
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'assign_page_role_from_url') THEN
    -- La fonction sera mise à jour dans une migration séparée si nécessaire
    RAISE NOTICE 'Function assign_page_role_from_url exists - R5 patterns should be added';
  END IF;
END $$;

-- ============================================
-- 7. COMMENTAIRES
-- ============================================

COMMENT ON TABLE __seo_observable IS 'Pages SEO R5 Diagnostic - Observable Pro (Symptom 60% / Sign 85% / DTC 95%)';
COMMENT ON COLUMN __seo_observable.observable_type IS 'Type: symptom (60%), sign (85%), dtc (95%) - fiabilité du diagnostic';
COMMENT ON COLUMN __seo_observable.perception_channel IS 'Canal: visual, auditory, olfactory, tactile, electronic, performance';
COMMENT ON COLUMN __seo_observable.safety_gate IS 'Gate sécurité: none, warning, stop_soon, stop_immediate';
COMMENT ON COLUMN __seo_observable.symptom_description IS 'Section "Ce que vous ressentez" - pour le client';
COMMENT ON COLUMN __seo_observable.sign_description IS 'Section "Ce que le technicien vérifie" - signes techniques';
COMMENT ON COLUMN __seo_observable.dtc_codes IS 'Codes OBD-II associés (P0xxx, Bxxxx, Cxxxx, Uxxxx)';
