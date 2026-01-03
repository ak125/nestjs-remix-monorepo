-- ============================================================================
-- MIGRATION: Tables legal_documents dédiées (Décomposition ___xtr_msg)
-- ============================================================================
-- Date: 2026-01-08
-- Objectif: Remplacer les LIKE queries sur ___xtr_msg pour les documents légaux
-- Impact: Performance + Séparation claire des données légales
-- ============================================================================

-- ============================================================================
-- PARTIE 1: Table legal_documents (remplace les entrées "type":"legal_document")
-- ============================================================================

CREATE TABLE IF NOT EXISTS legal_documents (
  id SERIAL PRIMARY KEY,

  -- Type de document
  document_type TEXT NOT NULL CHECK (document_type IN (
    'terms', 'privacy', 'cookies', 'gdpr', 'returns', 'shipping', 'warranty', 'custom'
  )),

  -- Contenu
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  slug TEXT NOT NULL,

  -- Versioning
  version TEXT DEFAULT 'v1.0',
  effective_date TIMESTAMPTZ DEFAULT NOW(),

  -- Statut
  published BOOLEAN DEFAULT FALSE,
  is_draft BOOLEAN DEFAULT TRUE,
  is_archived BOOLEAN DEFAULT FALSE,

  -- Langue
  language TEXT DEFAULT 'fr',

  -- Métadonnées
  metadata JSONB DEFAULT '{}',

  -- Audit
  created_by TEXT NOT NULL,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Référence legacy
  legacy_msg_id TEXT UNIQUE
);

-- Index pour requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_legal_docs_type ON legal_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_legal_docs_published ON legal_documents(published) WHERE published = TRUE;
CREATE INDEX IF NOT EXISTS idx_legal_docs_slug ON legal_documents(slug);
CREATE INDEX IF NOT EXISTS idx_legal_docs_language ON legal_documents(language);

-- ============================================================================
-- PARTIE 2: Table legal_document_versions (historique des versions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS legal_document_versions (
  id SERIAL PRIMARY KEY,

  -- Référence au document parent
  document_id INTEGER NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,

  -- Version
  version TEXT NOT NULL,
  content TEXT NOT NULL,
  changes TEXT,  -- Description des modifications

  -- Dates
  effective_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Audit
  created_by TEXT NOT NULL,

  -- Référence legacy
  legacy_msg_id TEXT UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_legal_versions_doc ON legal_document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_legal_versions_date ON legal_document_versions(created_at DESC);

-- ============================================================================
-- PARTIE 3: Table legal_acceptances (acceptations par les utilisateurs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS legal_acceptances (
  id SERIAL PRIMARY KEY,

  -- Utilisateur
  user_id TEXT NOT NULL,

  -- Document accepté
  document_id INTEGER REFERENCES legal_documents(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL,
  document_version TEXT NOT NULL,

  -- Contexte
  ip_address INET,
  user_agent TEXT,

  -- Date d'acceptation
  accepted_at TIMESTAMPTZ DEFAULT NOW(),

  -- Référence legacy
  legacy_msg_id TEXT UNIQUE,

  -- Contrainte: un utilisateur ne peut accepter une version qu'une fois
  UNIQUE(user_id, document_type, document_version)
);

CREATE INDEX IF NOT EXISTS idx_legal_accept_user ON legal_acceptances(user_id);
CREATE INDEX IF NOT EXISTS idx_legal_accept_doc ON legal_acceptances(document_id);
CREATE INDEX IF NOT EXISTS idx_legal_accept_type ON legal_acceptances(document_type);

-- ============================================================================
-- PARTIE 4: Trigger pour updated_at automatique
-- ============================================================================

CREATE OR REPLACE FUNCTION update_legal_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_legal_documents_updated_at ON legal_documents;
CREATE TRIGGER trigger_legal_documents_updated_at
  BEFORE UPDATE ON legal_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_legal_documents_updated_at();

-- ============================================================================
-- PARTIE 5: Migration des données existantes (si présentes dans ___xtr_msg)
-- ============================================================================

DO $$
DECLARE
  migrated_docs INTEGER := 0;
  migrated_accept INTEGER := 0;
  migrated_versions INTEGER := 0;
  row_data RECORD;
  content_json JSONB;
BEGIN
  RAISE NOTICE 'Début migration des documents légaux depuis ___xtr_msg...';

  -- 5.1 Migrer les documents légaux
  FOR row_data IN
    SELECT msg_id, msg_cst_id, msg_cnfa_id, msg_date, msg_subject, msg_content, msg_open, msg_close
    FROM ___xtr_msg
    WHERE msg_content IS NOT NULL
      AND msg_content LIKE '%"type":"legal_document"%'
    LIMIT 1000
  LOOP
    BEGIN
      content_json := row_data.msg_content::JSONB;

      INSERT INTO legal_documents (
        document_type, title, content, slug, version, effective_date,
        published, is_draft, is_archived, language, metadata,
        created_by, updated_by, created_at, updated_at, legacy_msg_id
      ) VALUES (
        COALESCE(content_json->>'documentType', 'custom'),
        row_data.msg_subject,
        COALESCE(content_json->>'content', ''),
        COALESCE(content_json->>'slug', ''),
        COALESCE(content_json->>'version', 'v1.0'),
        COALESCE((content_json->>'effectiveDate')::TIMESTAMPTZ, row_data.msg_date::TIMESTAMPTZ),
        COALESCE((content_json->>'published')::BOOLEAN, row_data.msg_open = '0'),
        row_data.msg_open = '1',
        row_data.msg_close = '1',
        COALESCE(content_json->>'language', 'fr'),
        COALESCE(content_json->'metadata', '{}'::JSONB),
        row_data.msg_cst_id,
        COALESCE(content_json->>'updatedBy', row_data.msg_cnfa_id),
        row_data.msg_date::TIMESTAMPTZ,
        COALESCE((content_json->>'lastUpdated')::TIMESTAMPTZ, row_data.msg_date::TIMESTAMPTZ),
        row_data.msg_id
      )
      ON CONFLICT (legacy_msg_id) DO NOTHING;

      migrated_docs := migrated_docs + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Erreur migration doc msg_id=%: %', row_data.msg_id, SQLERRM;
    END;
  END LOOP;

  -- 5.2 Migrer les acceptations
  FOR row_data IN
    SELECT msg_id, msg_cst_id, msg_date, msg_content
    FROM ___xtr_msg
    WHERE msg_content IS NOT NULL
      AND msg_content LIKE '%"type":"legal_acceptance"%'
    LIMIT 10000
  LOOP
    BEGIN
      content_json := row_data.msg_content::JSONB;

      INSERT INTO legal_acceptances (
        user_id, document_type, document_version, ip_address, user_agent,
        accepted_at, legacy_msg_id
      ) VALUES (
        COALESCE(content_json->>'userId', row_data.msg_cst_id),
        COALESCE(content_json->>'documentType', 'terms'),
        COALESCE(content_json->>'version', 'v1.0'),
        CASE WHEN content_json->>'ipAddress' IS NOT NULL
             THEN (content_json->>'ipAddress')::INET ELSE NULL END,
        content_json->>'userAgent',
        COALESCE((content_json->>'acceptedAt')::TIMESTAMPTZ, row_data.msg_date::TIMESTAMPTZ),
        row_data.msg_id
      )
      ON CONFLICT (legacy_msg_id) DO NOTHING;

      migrated_accept := migrated_accept + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Erreur migration accept msg_id=%: %', row_data.msg_id, SQLERRM;
    END;
  END LOOP;

  -- 5.3 Migrer les versions
  FOR row_data IN
    SELECT msg_id, msg_cst_id, msg_date, msg_content
    FROM ___xtr_msg
    WHERE msg_content IS NOT NULL
      AND msg_content LIKE '%"type":"legal_version"%'
    LIMIT 5000
  LOOP
    BEGIN
      content_json := row_data.msg_content::JSONB;

      -- Trouver le document parent
      INSERT INTO legal_document_versions (
        document_id, version, content, changes, effective_date,
        created_at, created_by, legacy_msg_id
      )
      SELECT
        ld.id,
        COALESCE(content_json->>'version', 'v1.0'),
        COALESCE(content_json->>'content', ''),
        content_json->>'changes',
        COALESCE((content_json->>'effectiveDate')::TIMESTAMPTZ, row_data.msg_date::TIMESTAMPTZ),
        row_data.msg_date::TIMESTAMPTZ,
        row_data.msg_cst_id,
        row_data.msg_id
      FROM legal_documents ld
      WHERE ld.legacy_msg_id = content_json->>'documentId'
        OR ld.id::TEXT = content_json->>'documentId'
      ON CONFLICT (legacy_msg_id) DO NOTHING;

      migrated_versions := migrated_versions + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Erreur migration version msg_id=%: %', row_data.msg_id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration documents légaux terminée:';
  RAISE NOTICE '  Documents migrés: %', migrated_docs;
  RAISE NOTICE '  Acceptations migrées: %', migrated_accept;
  RAISE NOTICE '  Versions migrées: %', migrated_versions;
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- PARTIE 6: Statistiques
-- ============================================================================

DO $$
DECLARE
  total_docs INTEGER;
  published_docs INTEGER;
  total_accept INTEGER;
  total_versions INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_docs FROM legal_documents;
  SELECT COUNT(*) INTO published_docs FROM legal_documents WHERE published = TRUE;
  SELECT COUNT(*) INTO total_accept FROM legal_acceptances;
  SELECT COUNT(*) INTO total_versions FROM legal_document_versions;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Statistiques tables légales:';
  RAISE NOTICE '  Documents: % (publiés: %)', total_docs, published_docs;
  RAISE NOTICE '  Acceptations: %', total_accept;
  RAISE NOTICE '  Versions: %', total_versions;
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- PARTIE 7: Commentaires
-- ============================================================================

COMMENT ON TABLE legal_documents IS 'Documents légaux (CGV, RGPD, etc.) - Migré depuis ___xtr_msg';
COMMENT ON TABLE legal_document_versions IS 'Historique des versions des documents légaux';
COMMENT ON TABLE legal_acceptances IS 'Acceptations des documents légaux par les utilisateurs';
