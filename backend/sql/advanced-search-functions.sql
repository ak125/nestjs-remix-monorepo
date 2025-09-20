-- 🔍 FONCTIONS SQL AVANCÉES POUR SEARCH ENGINE
-- Extension des fonctionnalités de recherche selon "vérifier existant et utiliser le meilleur"

-- Extensions PostgreSQL requises
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- ============================================================================
-- 1. FONCTION DE RECHERCHE AVANCÉE AVEC SCORING PERSONNALISÉ
-- ============================================================================

CREATE OR REPLACE FUNCTION advanced_search_with_scoring(
  p_query TEXT,
  p_filters JSONB DEFAULT '{}',
  p_weights JSONB DEFAULT '{"reference": 1.5, "designation": 1.0, "brand": 0.8, "category": 0.5}'
)
RETURNS TABLE (
  piece_id INTEGER,
  piece_title VARCHAR,
  piece_ref VARCHAR,
  piece_marque VARCHAR,
  piece_gamme VARCHAR,
  piece_description TEXT,
  piece_price_public DECIMAL,
  piece_stock INTEGER,
  relevance_score DECIMAL
) AS $$
DECLARE
  weight_ref DECIMAL := COALESCE((p_weights->>'reference')::DECIMAL, 1.5);
  weight_desc DECIMAL := COALESCE((p_weights->>'designation')::DECIMAL, 1.0);
  weight_brand DECIMAL := COALESCE((p_weights->>'brand')::DECIMAL, 0.8);
  weight_cat DECIMAL := COALESCE((p_weights->>'category')::DECIMAL, 0.5);
BEGIN
  RETURN QUERY
  SELECT 
    p.piece_id,
    p.piece_title,
    p.piece_ref,
    p.piece_marque,
    p.piece_gamme,
    p.piece_description,
    p.piece_price_public,
    p.piece_stock,
    -- Calcul du score de pertinence personnalisé
    (
      CASE WHEN p.piece_ref ILIKE '%' || p_query || '%' THEN weight_ref ELSE 0 END +
      CASE WHEN p.piece_title ILIKE '%' || p_query || '%' THEN weight_desc ELSE 0 END +
      CASE WHEN p.piece_marque ILIKE '%' || p_query || '%' THEN weight_brand ELSE 0 END +
      CASE WHEN p.piece_gamme ILIKE '%' || p_query || '%' THEN weight_cat ELSE 0 END +
      -- Bonus pour correspondance exacte
      CASE WHEN UPPER(p.piece_ref) = UPPER(p_query) THEN 2.0 ELSE 0 END +
      -- Bonus pour début de mot
      CASE WHEN p.piece_title ILIKE p_query || '%' THEN 0.5 ELSE 0 END
    )::DECIMAL AS relevance_score
  FROM pieces p
  WHERE p.piece_statut = '1'
    AND (
      p.piece_ref ILIKE '%' || p_query || '%' OR
      p.piece_title ILIKE '%' || p_query || '%' OR
      p.piece_marque ILIKE '%' || p_query || '%' OR
      p.piece_gamme ILIKE '%' || p_query || '%' OR
      p.piece_description ILIKE '%' || p_query || '%'
    )
    -- Application des filtres optionnels
    AND CASE WHEN p_filters ? 'brandId' THEN p.piece_marque = (p_filters->>'brandId') ELSE true END
    AND CASE WHEN p_filters ? 'inStock' AND (p_filters->>'inStock')::BOOLEAN THEN p.piece_stock > 0 ELSE true END
    AND CASE WHEN p_filters ? 'priceMin' THEN p.piece_price_public >= (p_filters->>'priceMin')::DECIMAL ELSE true END
    AND CASE WHEN p_filters ? 'priceMax' THEN p.piece_price_public <= (p_filters->>'priceMax')::DECIMAL ELSE true END
  ORDER BY relevance_score DESC, p.piece_title
  LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. FONCTION DE RECHERCHE FLOUE (FUZZY) AVEC PG_TRGM
-- ============================================================================

CREATE OR REPLACE FUNCTION fuzzy_search(
  p_query TEXT,
  p_threshold DECIMAL DEFAULT 0.3
)
RETURNS TABLE (
  piece_id INTEGER,
  piece_title VARCHAR,
  piece_ref VARCHAR,
  piece_marque VARCHAR,
  piece_gamme VARCHAR,
  piece_description TEXT,
  piece_price_public DECIMAL,
  piece_stock INTEGER,
  similarity_score DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.piece_id,
    p.piece_title,
    p.piece_ref,
    p.piece_marque,
    p.piece_gamme,
    p.piece_description,
    p.piece_price_public,
    p.piece_stock,
    GREATEST(
      similarity(p.piece_title, p_query),
      similarity(p.piece_ref, p_query),
      similarity(p.piece_marque, p_query),
      similarity(p.piece_gamme, p_query)
    )::DECIMAL AS similarity_score
  FROM pieces p
  WHERE p.piece_statut = '1'
    AND (
      similarity(p.piece_title, p_query) > p_threshold OR
      similarity(p.piece_ref, p_query) > p_threshold OR
      similarity(p.piece_marque, p_query) > p_threshold OR
      similarity(p.piece_gamme, p_query) > p_threshold
    )
  ORDER BY similarity_score DESC, p.piece_title
  LIMIT 30;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. FONCTION DE RECHERCHE PHONÉTIQUE (SOUNDEX)
-- ============================================================================

CREATE OR REPLACE FUNCTION phonetic_search(
  p_query TEXT
)
RETURNS TABLE (
  piece_id INTEGER,
  piece_title VARCHAR,
  piece_ref VARCHAR,
  piece_marque VARCHAR,
  piece_gamme VARCHAR,
  piece_description TEXT,
  piece_price_public DECIMAL,
  piece_stock INTEGER,
  phonetic_match BOOLEAN
) AS $$
DECLARE
  query_soundex TEXT;
BEGIN
  -- Génération du soundex pour la requête
  query_soundex := soundex(p_query);
  
  RETURN QUERY
  SELECT 
    p.piece_id,
    p.piece_title,
    p.piece_ref,
    p.piece_marque,
    p.piece_gamme,
    p.piece_description,
    p.piece_price_public,
    p.piece_stock,
    true AS phonetic_match
  FROM pieces p
  WHERE p.piece_statut = '1'
    AND (
      soundex(p.piece_title) = query_soundex OR
      soundex(p.piece_ref) = query_soundex OR
      soundex(p.piece_marque) = query_soundex OR
      soundex(p.piece_gamme) = query_soundex OR
      -- Alternative avec levenshtein pour plus de flexibilité
      levenshtein(UPPER(p.piece_title), UPPER(p_query)) <= 3 OR
      levenshtein(UPPER(p.piece_ref), UPPER(p_query)) <= 2
    )
  ORDER BY 
    -- Priorité aux correspondances soundex exactes
    CASE WHEN soundex(p.piece_title) = query_soundex THEN 1 ELSE 2 END,
    p.piece_title
  LIMIT 25;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. INDEX POUR OPTIMISER LES PERFORMANCES
-- ============================================================================

-- Index GIN pour recherche full-text rapide
CREATE INDEX IF NOT EXISTS idx_pieces_search_gin 
ON pieces USING gin (piece_title gin_trgm_ops, piece_ref gin_trgm_ops);

-- Index pour les recherches par marque et gamme
CREATE INDEX IF NOT EXISTS idx_pieces_brand_gamme 
ON pieces (piece_marque, piece_gamme) WHERE piece_statut = '1';

-- Index pour les prix (filtres)
CREATE INDEX IF NOT EXISTS idx_pieces_price_stock 
ON pieces (piece_price_public, piece_stock) WHERE piece_statut = '1';

-- ============================================================================
-- 5. FONCTION DE TEST DES NOUVELLES FONCTIONNALITÉS
-- ============================================================================

CREATE OR REPLACE FUNCTION test_advanced_search_functions()
RETURNS TABLE (
  test_name TEXT,
  result_count INTEGER,
  status TEXT
) AS $$
DECLARE
  test_count INTEGER;
BEGIN
  -- Test 1: Advanced Search avec scoring
  BEGIN
    SELECT COUNT(*)::INTEGER INTO test_count 
    FROM advanced_search_with_scoring('BMW', '{}', '{"reference": 2.0, "designation": 1.0}');
    RETURN QUERY SELECT 'advanced_search_with_scoring(BMW)'::TEXT, test_count, 'SUCCESS'::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'advanced_search_with_scoring(BMW)'::TEXT, 0, ('ERROR: ' || SQLERRM)::TEXT;
  END;

  -- Test 2: Fuzzy Search
  BEGIN
    SELECT COUNT(*)::INTEGER INTO test_count 
    FROM fuzzy_search('frien', 0.3); -- "frein" avec faute de frappe
    RETURN QUERY SELECT 'fuzzy_search(frien)'::TEXT, test_count, 'SUCCESS'::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'fuzzy_search(frien)'::TEXT, 0, ('ERROR: ' || SQLERRM)::TEXT;
  END;

  -- Test 3: Phonetic Search
  BEGIN
    SELECT COUNT(*)::INTEGER INTO test_count 
    FROM phonetic_search('bosch'); -- Recherche phonétique
    RETURN QUERY SELECT 'phonetic_search(bosch)'::TEXT, test_count, 'SUCCESS'::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'phonetic_search(bosch)'::TEXT, 0, ('ERROR: ' || SQLERRM)::TEXT;
  END;

END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. COMMENTAIRES DE DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION advanced_search_with_scoring(TEXT, JSONB, JSONB) 
IS 'Recherche avancée avec scoring personnalisé selon les poids définis';

COMMENT ON FUNCTION fuzzy_search(TEXT, DECIMAL) 
IS 'Recherche floue utilisant pg_trgm pour la tolérance aux fautes de frappe';

COMMENT ON FUNCTION phonetic_search(TEXT) 
IS 'Recherche phonétique utilisant soundex et levenshtein pour similarité sonore';

COMMENT ON FUNCTION test_advanced_search_functions() 
IS 'Tests automatiques des nouvelles fonctions de recherche avancée';
