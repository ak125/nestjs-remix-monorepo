-- ============================================================================
-- Migration : 20260418_diag_public_surface
-- But : Exposer publiquement le moteur diagnostic + entretien (plan breezy-eagle)
--   - Ajout presentation (icon_slug, color_token) sur __diag_system
--   - Ajout discoverability (synonyms, dtc_codes) sur __diag_symptom
--   - Extensions et index pour la recherche plein-texte + DTC lookup
-- Non destructif : toutes colonnes nullables / DEFAULT vide, rollback possible.
-- ============================================================================

-- 1. Extensions -----------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. __diag_system : colonnes presentation UI --------------------------------
ALTER TABLE __diag_system
  ADD COLUMN IF NOT EXISTS icon_slug text,
  ADD COLUMN IF NOT EXISTS color_token text;

-- Seed presentation pour les 13 systemes actifs
-- icon_slug = nom kebab-case d'un lucide-react icon ; color_token = Tailwind base
UPDATE __diag_system SET icon_slug='snowflake',         color_token='sky'     WHERE slug='climatisation';
UPDATE __diag_system SET icon_slug='battery-charging',  color_token='amber'   WHERE slug='demarrage_charge';
UPDATE __diag_system SET icon_slug='move-horizontal',   color_token='indigo'  WHERE slug='direction';
UPDATE __diag_system SET icon_slug='cog',               color_token='purple'  WHERE slug='distribution';
UPDATE __diag_system SET icon_slug='wind',              color_token='slate'   WHERE slug='echappement';
UPDATE __diag_system SET icon_slug='lightbulb',         color_token='yellow'  WHERE slug='eclairage';
UPDATE __diag_system SET icon_slug='disc-3',            color_token='orange'  WHERE slug='embrayage';
UPDATE __diag_system SET icon_slug='filter',            color_token='emerald' WHERE slug='filtration';
UPDATE __diag_system SET icon_slug='shield',            color_token='red'     WHERE slug='freinage';
UPDATE __diag_system SET icon_slug='fuel',              color_token='teal'    WHERE slug='injection';
UPDATE __diag_system SET icon_slug='thermometer-sun',   color_token='cyan'    WHERE slug='refroidissement';
UPDATE __diag_system SET icon_slug='car',               color_token='blue'    WHERE slug='suspension';
UPDATE __diag_system SET icon_slug='settings-2',        color_token='stone'   WHERE slug='transmission';

-- 3. __diag_symptom : discoverability (synonymes + DTC) ----------------------
ALTER TABLE __diag_symptom
  ADD COLUMN IF NOT EXISTS synonyms text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dtc_codes text[] NOT NULL DEFAULT '{}';

-- Backfill DTC depuis __seo_observable quand slug matche (non destructif)
UPDATE __diag_symptom s
SET dtc_codes = obs.dtc_codes
FROM __seo_observable obs
WHERE obs.slug = s.slug
  AND obs.dtc_codes IS NOT NULL
  AND array_length(obs.dtc_codes, 1) > 0
  AND array_length(s.dtc_codes, 1) IS NULL;

-- 4. Index pour search + DTC lookup -----------------------------------------
CREATE INDEX IF NOT EXISTS __diag_symptom_label_trgm
  ON __diag_symptom USING gin (label gin_trgm_ops);

CREATE INDEX IF NOT EXISTS __diag_symptom_dtc_gin
  ON __diag_symptom USING gin (dtc_codes);

CREATE INDEX IF NOT EXISTS __diag_symptom_synonyms_gin
  ON __diag_symptom USING gin (synonyms);

CREATE INDEX IF NOT EXISTS __diag_maintenance_operation_label_trgm
  ON __diag_maintenance_operation USING gin (label gin_trgm_ops);

-- 5. __diag_maintenance_operation : synonymes pour recherche publique --------
ALTER TABLE __diag_maintenance_operation
  ADD COLUMN IF NOT EXISTS synonyms text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS __diag_maintenance_synonyms_gin
  ON __diag_maintenance_operation USING gin (synonyms);

-- 6. Extension unaccent + RPC de recherche propre ----------------------------
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION immutable_unaccent(text)
RETURNS text AS $$
  SELECT unaccent('unaccent', $1)
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION search_diag_symptoms(p_q text, p_limit integer DEFAULT 10)
RETURNS SETOF __diag_symptom
LANGUAGE sql STABLE AS $$
  WITH q AS (SELECT lower(immutable_unaccent($1)) AS needle)
  SELECT DISTINCT s.*
  FROM __diag_symptom s, q
  WHERE s.active = true
    AND (
      lower(immutable_unaccent(s.label)) LIKE '%' || q.needle || '%'
      OR lower(immutable_unaccent(coalesce(s.description, ''))) LIKE '%' || q.needle || '%'
      OR EXISTS (
        SELECT 1 FROM unnest(s.synonyms) AS syn
        WHERE lower(immutable_unaccent(syn)) LIKE '%' || q.needle || '%'
      )
      OR EXISTS (
        SELECT 1 FROM unnest(s.dtc_codes) AS d
        WHERE lower(d) LIKE '%' || lower($1) || '%'
      )
    )
  ORDER BY s.slug
  LIMIT $2;
$$;

CREATE OR REPLACE FUNCTION search_diag_maintenance(p_q text, p_limit integer DEFAULT 10)
RETURNS SETOF __diag_maintenance_operation
LANGUAGE sql STABLE AS $$
  WITH q AS (SELECT lower(immutable_unaccent($1)) AS needle)
  SELECT DISTINCT m.*
  FROM __diag_maintenance_operation m, q
  WHERE m.active = true
    AND (
      lower(immutable_unaccent(m.label)) LIKE '%' || q.needle || '%'
      OR lower(immutable_unaccent(coalesce(m.description, ''))) LIKE '%' || q.needle || '%'
      OR EXISTS (
        SELECT 1 FROM unnest(m.synonyms) AS syn
        WHERE lower(immutable_unaccent(syn)) LIKE '%' || q.needle || '%'
      )
    )
  ORDER BY m.slug
  LIMIT $2;
$$;

-- 7. Commentaires (documentation) --------------------------------------------
COMMENT ON COLUMN __diag_system.icon_slug IS 'lucide-react icon slug (kebab-case), map client-side';
COMMENT ON COLUMN __diag_system.color_token IS 'Tailwind color base token (ex: red, blue, amber)';
COMMENT ON COLUMN __diag_symptom.synonyms IS 'Synonymes pour recherche typeahead (plain text, lowercased)';
COMMENT ON COLUMN __diag_symptom.dtc_codes IS 'Codes OBD-II (P/C/B/U + 4 chiffres) associés au symptôme';
COMMENT ON COLUMN __diag_maintenance_operation.synonyms IS 'Synonymes pour recherche typeahead (FR + EN courants)';
COMMENT ON FUNCTION search_diag_symptoms(text, integer) IS 'Recherche symptome multi-champs avec unaccent + substring in array';
COMMENT ON FUNCTION search_diag_maintenance(text, integer) IS 'Recherche entretien multi-champs avec unaccent + substring in array';
