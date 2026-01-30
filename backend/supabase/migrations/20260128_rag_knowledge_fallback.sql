-- =====================================================
-- RAG Knowledge Fallback Table
-- Used when external RAG service is unavailable
-- =====================================================

-- Table pour stocker les connaissances locales (fallback RAG)
CREATE TABLE IF NOT EXISTS __rag_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contenu
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_tsv TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('french', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('french', coalesce(content, '')), 'B')
  ) STORED,

  -- Métadonnées
  source TEXT NOT NULL, -- e.g., 'canon/architecture.md', 'manual/freinage.md'
  truth_level TEXT NOT NULL DEFAULT 'L2' CHECK (truth_level IN ('L1', 'L2', 'L3', 'L4')),
  domain TEXT, -- e.g., 'freinage', 'moteur', 'suspension'
  category TEXT, -- e.g., 'definition', 'diagnostic', 'procedure'

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche full-text
CREATE INDEX IF NOT EXISTS idx_rag_knowledge_tsv
  ON __rag_knowledge USING GIN (content_tsv);

-- Index pour filtrage par domaine/catégorie
CREATE INDEX IF NOT EXISTS idx_rag_knowledge_domain
  ON __rag_knowledge (domain);

CREATE INDEX IF NOT EXISTS idx_rag_knowledge_category
  ON __rag_knowledge (category);

CREATE INDEX IF NOT EXISTS idx_rag_knowledge_truth_level
  ON __rag_knowledge (truth_level);

-- Fonction de recherche FTS avec ranking
CREATE OR REPLACE FUNCTION search_rag_knowledge(
  p_query TEXT,
  p_limit INT DEFAULT 5,
  p_domain TEXT DEFAULT NULL,
  p_min_truth_level TEXT DEFAULT 'L3'
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  source TEXT,
  truth_level TEXT,
  domain TEXT,
  rank REAL
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_tsquery TSQUERY;
  v_truth_levels TEXT[];
BEGIN
  -- Construire le tsquery
  v_tsquery := plainto_tsquery('french', p_query);

  -- Définir les niveaux de vérité acceptés
  v_truth_levels := CASE p_min_truth_level
    WHEN 'L1' THEN ARRAY['L1']
    WHEN 'L2' THEN ARRAY['L1', 'L2']
    WHEN 'L3' THEN ARRAY['L1', 'L2', 'L3']
    ELSE ARRAY['L1', 'L2', 'L3', 'L4']
  END;

  RETURN QUERY
  SELECT
    k.id,
    k.title,
    k.content,
    k.source,
    k.truth_level,
    k.domain,
    ts_rank(k.content_tsv, v_tsquery) AS rank
  FROM __rag_knowledge k
  WHERE
    k.content_tsv @@ v_tsquery
    AND k.truth_level = ANY(v_truth_levels)
    AND (p_domain IS NULL OR k.domain = p_domain)
  ORDER BY rank DESC
  LIMIT p_limit;
END;
$$;

-- Seed avec quelques connaissances de base (canon)
INSERT INTO __rag_knowledge (title, content, source, truth_level, domain, category)
VALUES
  (
    'Disque de frein - Définition',
    'Un disque de frein est un composant essentiel du système de freinage automobile. Il s''agit d''un disque métallique fixé au moyeu de la roue qui tourne avec elle. Lorsque le conducteur appuie sur la pédale de frein, les plaquettes de frein viennent serrer le disque, créant une friction qui ralentit la rotation de la roue et donc le véhicule. Les disques peuvent être pleins ou ventilés (avec des ailettes internes pour un meilleur refroidissement).',
    'canon/definitions/freinage.md',
    'L1',
    'freinage',
    'definition'
  ),
  (
    'Plaquettes de frein - Définition',
    'Les plaquettes de frein sont des pièces d''usure constituées d''un support métallique et d''une garniture de friction. Elles sont montées dans l''étrier de frein et viennent serrer le disque de frein lors du freinage. La garniture peut être organique, semi-métallique ou céramique selon les applications. Les plaquettes doivent être remplacées régulièrement car leur usure est normale.',
    'canon/definitions/freinage.md',
    'L1',
    'freinage',
    'definition'
  ),
  (
    'Embrayage - Définition',
    'L''embrayage est un système mécanique permettant de transmettre ou d''interrompre le couple moteur vers la boîte de vitesses. Il est composé principalement d''un volant moteur, d''un disque d''embrayage, d''un mécanisme de pression et d''une butée. Lorsque la pédale d''embrayage est enfoncée, le disque se désolidarise du volant moteur, permettant de changer de rapport.',
    'canon/definitions/transmission.md',
    'L1',
    'transmission',
    'definition'
  ),
  (
    'Amortisseur - Définition',
    'L''amortisseur est un élément de la suspension qui absorbe et dissipe l''énergie des oscillations du ressort. Il assure le confort de conduite et maintient le contact des roues avec le sol. Les amortisseurs peuvent être hydrauliques, à gaz ou oléopneumatiques. Un amortisseur usé se manifeste par un comportement instable du véhicule, des rebonds excessifs et une usure prématurée des pneus.',
    'canon/definitions/suspension.md',
    'L1',
    'suspension',
    'definition'
  ),
  (
    'Bruit de freinage - Diagnostic',
    'Un bruit de freinage peut avoir plusieurs origines : plaquettes usées jusqu''au témoin d''usure (sifflement aigu), disques voilés (vibration et bruit rythmé), corps étranger coincé (grincement), plaquettes de mauvaise qualité (couinement). Le diagnostic commence par une inspection visuelle des plaquettes et disques. Une épaisseur de plaquette inférieure à 3mm nécessite un remplacement.',
    'canon/diagnostic/freinage.md',
    'L2',
    'freinage',
    'diagnostic'
  )
ON CONFLICT DO NOTHING;

-- Commentaire
COMMENT ON TABLE __rag_knowledge IS 'Base de connaissances locale pour fallback RAG - utilisé quand le service RAG externe est indisponible';
