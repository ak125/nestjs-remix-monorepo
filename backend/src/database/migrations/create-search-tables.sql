-- 🔍 Migration Supabase - Tables de recherche (minuscules)
-- Basé sur l'analyse du code PHP original

-- ===============================================
-- TABLE: pieces_ref_search (indexation recherche)
-- ===============================================
CREATE TABLE IF NOT EXISTS pieces_ref_search (
  prs_id SERIAL PRIMARY KEY,
  prs_piece_id INTEGER NOT NULL,
  prs_search TEXT NOT NULL, -- terme de recherche indexé
  prs_ref TEXT, -- référence associée  
  prs_prb_id INTEGER, -- lien vers pieces_ref_brand
  prs_kind INTEGER DEFAULT 0, -- type de référence (0=normal, 1=prioritaire)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_pieces_ref_search_search ON pieces_ref_search(prs_search);
CREATE INDEX IF NOT EXISTS idx_pieces_ref_search_piece_id ON pieces_ref_search(prs_piece_id);
CREATE INDEX IF NOT EXISTS idx_pieces_ref_search_kind ON pieces_ref_search(prs_kind);

-- ===============================================
-- TABLE: pieces_ref_brand (références par marque)
-- ===============================================
CREATE TABLE IF NOT EXISTS pieces_ref_brand (
  prb_id SERIAL PRIMARY KEY,
  prb_name TEXT NOT NULL,
  prb_alias TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===============================================
-- TABLE: pieces (table principale des pièces)
-- ===============================================
CREATE TABLE IF NOT EXISTS pieces (
  piece_id SERIAL PRIMARY KEY,
  piece_ref TEXT,
  piece_name TEXT NOT NULL,
  piece_name_comp TEXT, -- nom complémentaire
  piece_name_side TEXT, -- côté (gauche/droite)
  piece_des TEXT, -- description
  piece_pg_id INTEGER, -- gamme
  piece_pm_id INTEGER, -- marque/équipementier principal
  piece_has_img INTEGER DEFAULT 0, -- a des images
  piece_has_oem INTEGER DEFAULT 0, -- a des références OEM
  piece_qty_sale INTEGER DEFAULT 1, -- quantité de vente
  piece_qty_pack INTEGER DEFAULT 1, -- quantité par pack
  piece_weight_kgm DECIMAL(10,3) DEFAULT 0, -- poids en kg
  piece_display INTEGER DEFAULT 1, -- affiché (1=oui, 0=non)
  piece_sort INTEGER DEFAULT 0, -- ordre de tri
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_pieces_display ON pieces(piece_display);
CREATE INDEX IF NOT EXISTS idx_pieces_pg_id ON pieces(piece_pg_id);
CREATE INDEX IF NOT EXISTS idx_pieces_pm_id ON pieces(piece_pm_id);

-- ===============================================
-- TABLE: pieces_gamme (gammes/catégories)
-- ===============================================
CREATE TABLE IF NOT EXISTS pieces_gamme (
  pg_id SERIAL PRIMARY KEY,
  pg_name TEXT NOT NULL,
  pg_alias TEXT NOT NULL,
  pg_name_url TEXT, -- nom pour URL
  pg_name_meta TEXT, -- nom pour meta
  pg_pic TEXT, -- icône
  pg_img TEXT, -- image
  pg_display INTEGER DEFAULT 1,
  pg_level INTEGER DEFAULT 0, -- niveau hiérarchique
  pg_top INTEGER DEFAULT 0, -- gamme top
  pg_parent INTEGER, -- parent
  pg_sort INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_pieces_gamme_display ON pieces_gamme(pg_display);
CREATE INDEX IF NOT EXISTS idx_pieces_gamme_alias ON pieces_gamme(pg_alias);

-- ===============================================
-- TABLE: pieces_marque (équipementiers/marques)
-- ===============================================
CREATE TABLE IF NOT EXISTS pieces_marque (
  pm_id SERIAL PRIMARY KEY,
  pm_name TEXT NOT NULL,
  pm_alias TEXT,
  pm_logo TEXT, -- logo de la marque
  pm_quality TEXT, -- description qualité
  pm_oes CHAR(1), -- A=Aftermarket, O=OES
  pm_nb_stars INTEGER DEFAULT 0, -- notation étoiles
  pm_display INTEGER DEFAULT 1,
  pm_sort INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_pieces_marque_display ON pieces_marque(pm_display);
CREATE INDEX IF NOT EXISTS idx_pieces_marque_oes ON pieces_marque(pm_oes);
CREATE INDEX IF NOT EXISTS idx_pieces_marque_stars ON pieces_marque(pm_nb_stars);

-- ===============================================
-- TABLE: pieces_price (prix)
-- ===============================================
CREATE TABLE IF NOT EXISTS pieces_price (
  pri_id SERIAL PRIMARY KEY,
  pri_piece_id INTEGER NOT NULL,
  pri_pm_id INTEGER NOT NULL, -- marque/fournisseur
  pri_vente_ht DECIMAL(10,2) DEFAULT 0,
  pri_vente_ttc DECIMAL(10,2) DEFAULT 0,
  pri_consigne_ttc DECIMAL(10,2) DEFAULT 0, -- consigne échange standard
  pri_dispo CHAR(1) DEFAULT '1', -- disponible
  pri_type INTEGER DEFAULT 0, -- type de prix (priorité)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_pieces_price_piece_id ON pieces_price(pri_piece_id);
CREATE INDEX IF NOT EXISTS idx_pieces_price_dispo ON pieces_price(pri_dispo);

-- ===============================================
-- TABLE: pieces_media_img (images)
-- ===============================================
CREATE TABLE IF NOT EXISTS pieces_media_img (
  pmi_id SERIAL PRIMARY KEY,
  pmi_piece_id INTEGER NOT NULL,
  pmi_folder TEXT NOT NULL,
  pmi_name TEXT NOT NULL,
  pmi_display INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_pieces_media_img_piece_id ON pieces_media_img(pmi_piece_id);
CREATE INDEX IF NOT EXISTS idx_pieces_media_img_display ON pieces_media_img(pmi_display);

-- ===============================================
-- TABLE: pieces_criteria (critères techniques)
-- ===============================================
CREATE TABLE IF NOT EXISTS pieces_criteria (
  pc_id SERIAL PRIMARY KEY,
  pc_piece_id INTEGER NOT NULL,
  pc_cri_id INTEGER NOT NULL, -- ID du critère
  pc_pg_pid INTEGER, -- lien gamme-parent
  pc_cri_value TEXT, -- valeur du critère
  pc_display INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===============================================
-- TABLE: pieces_criteria_link (définition des critères)
-- ===============================================
CREATE TABLE IF NOT EXISTS pieces_criteria_link (
  pcl_id SERIAL PRIMARY KEY,
  pcl_cri_id INTEGER NOT NULL,
  pcl_pg_pid INTEGER NOT NULL,
  pcl_cri_criteria TEXT NOT NULL, -- nom du critère
  pcl_cri_unit TEXT, -- unité
  pcl_level INTEGER DEFAULT 0,
  pcl_sort INTEGER DEFAULT 0,
  pcl_display INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===============================================
-- VUES pour simplifier les requêtes
-- ===============================================

-- Vue: recherche complète (équivalent de la requête PHP)
CREATE OR REPLACE VIEW v_search_complete AS
SELECT DISTINCT 
  p.piece_id,
  p.piece_ref,
  p.piece_name,
  p.piece_name_comp,
  p.piece_name_side,
  p.piece_has_img,
  p.piece_has_oem,
  p.piece_qty_sale,
  p.piece_qty_pack,
  p.piece_weight_kgm,
  pg.pg_id,
  pg.pg_name,
  pg.pg_alias,
  pm.pm_id,
  pm.pm_name,
  pm.pm_logo,
  pm.pm_quality,
  pm.pm_oes,
  pm.pm_nb_stars,
  prb.prb_name,
  prs.prs_search,
  prs.prs_ref,
  prs.prs_kind,
  pri.pri_vente_ttc,
  pri.pri_consigne_ttc,
  CASE 
    WHEN pmi.pmi_name IS NOT NULL 
    THEN CONCAT('rack/', pmi.pmi_folder, '/', pmi.pmi_name)
    ELSE 'upload/articles/no.png'
  END as piece_img
FROM pieces_ref_search prs
INNER JOIN pieces p ON p.piece_id = prs.prs_piece_id
LEFT JOIN pieces_ref_brand prb ON prb.prb_id = prs.prs_prb_id
INNER JOIN pieces_gamme pg ON pg.pg_id = p.piece_pg_id
INNER JOIN pieces_price pri ON pri.pri_piece_id = p.piece_id
INNER JOIN pieces_marque pm ON pm.pm_id = pri.pri_pm_id
LEFT JOIN pieces_media_img pmi ON pmi.pmi_piece_id = p.piece_id AND pmi.pmi_display = 1
WHERE p.piece_display = 1 
  AND pg.pg_display = 1 
  AND pm.pm_display = 1 
  AND pri.pri_dispo = '1';

-- Vue: critères techniques
CREATE OR REPLACE VIEW v_pieces_criteria AS
SELECT 
  pc.pc_piece_id,
  pcl.pcl_cri_criteria,
  pc.pc_cri_value as pcl_value,
  pcl.pcl_cri_unit,
  pcl.pcl_level,
  pcl.pcl_sort
FROM pieces_criteria pc
INNER JOIN pieces_criteria_link pcl ON pcl.pcl_cri_id = pc.pc_cri_id AND pcl.pcl_pg_pid = pc.pc_pg_pid
WHERE pc.pc_display = 1 AND pcl.pcl_display = 1
ORDER BY pcl.pcl_level, pcl.pcl_sort, pcl.pcl_cri_criteria;

-- ===============================================
-- RLS (Row Level Security) pour Supabase
-- ===============================================
ALTER TABLE pieces_ref_search ENABLE ROW LEVEL SECURITY;
ALTER TABLE pieces ENABLE ROW LEVEL SECURITY;
ALTER TABLE pieces_gamme ENABLE ROW LEVEL SECURITY;
ALTER TABLE pieces_marque ENABLE ROW LEVEL SECURITY;
ALTER TABLE pieces_price ENABLE ROW LEVEL SECURITY;
ALTER TABLE pieces_media_img ENABLE ROW LEVEL SECURITY;

-- Politiques de lecture pour tous (données publiques)
CREATE POLICY "Enable read for all" ON pieces_ref_search FOR SELECT USING (true);
CREATE POLICY "Enable read for all" ON pieces FOR SELECT USING (piece_display = 1);
CREATE POLICY "Enable read for all" ON pieces_gamme FOR SELECT USING (pg_display = 1);
CREATE POLICY "Enable read for all" ON pieces_marque FOR SELECT USING (pm_display = 1);
CREATE POLICY "Enable read for all" ON pieces_price FOR SELECT USING (pri_dispo = '1');
CREATE POLICY "Enable read for all" ON pieces_media_img FOR SELECT USING (pmi_display = 1);

-- ===============================================
-- FONCTIONS utilitaires
-- ===============================================

-- Fonction de nettoyage des termes de recherche (équivalent ClearSearchQuest)
CREATE OR REPLACE FUNCTION clean_search_quest(quest TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Nettoyage basique (à adapter selon les besoins)
  quest := TRIM(LOWER(quest));
  quest := REGEXP_REPLACE(quest, '[^a-z0-9\s]', '', 'g');
  quest := REGEXP_REPLACE(quest, '\s+', ' ', 'g');
  RETURN quest;
END;
$$ LANGUAGE plpgsql;

-- Fonction de recherche optimisée
CREATE OR REPLACE FUNCTION search_pieces(quest TEXT)
RETURNS TABLE(
  piece_id INTEGER,
  piece_name TEXT,
  piece_ref TEXT,
  pm_name TEXT,
  pg_name TEXT,
  price_ttc DECIMAL,
  relevance_score INTEGER
) AS $$
DECLARE
  cleaned_quest TEXT;
BEGIN
  cleaned_quest := clean_search_quest(quest);
  
  RETURN QUERY
  SELECT DISTINCT
    vsc.piece_id,
    CONCAT(vsc.piece_name, ' ', COALESCE(vsc.piece_name_side, ''), ' ', COALESCE(vsc.piece_name_comp, '')) as piece_name,
    vsc.piece_ref,
    vsc.pm_name,
    vsc.pg_name,
    vsc.pri_vente_ttc * vsc.piece_qty_sale as price_ttc,
    vsc.prs_kind as relevance_score
  FROM v_search_complete vsc
  WHERE vsc.prs_search = cleaned_quest
  ORDER BY vsc.prs_kind, vsc.pri_vente_ttc * vsc.piece_qty_sale;
END;
$$ LANGUAGE plpgsql;