-- =====================================================
-- Diagnostic — `__diag_symptom.label_aliases` (ADR-112 phase 0, ADR-033 D4)
-- Date: 2026-10-05
-- Refs: ADR-112 §Amendements « ADR-033 » (governance-vault) : « `label_aliases` sur
--       `__diag_symptom` (prévu par ADR-033 D4, absent de la base) est introduit en
--       phase 0, par migration relue » ; ADR-033 D4 : le libellé d'un symptôme est
--       résolu en `symptom_slug` par lookup sur `__diag_symptom.slug` +
--       `__diag_symptom.label_aliases[]`, et tout libellé non résolu bloque.
-- =====================================================
--
-- CE QUE FAIT CETTE MIGRATION : ajoute la colonne, vide pour toutes les lignes.
-- Elle n'écrit aucun alias. Les alias arrivent plus tard, par migration relue, avec
-- le consommateur D4 (phase 3) qui les lit.
--
-- Contrainte de forme (`__diag_symptom_label_aliases_shape`) : tableau à une
-- dimension, sans élément NULL ni chaîne vide. L'unicité d'un alias entre lignes
-- (un alias ne doit désigner qu'un symptôme) ne s'exprime pas en CHECK : elle sera
-- vérifiée par le consommateur D4, qui bloque sur tout alias ambigu, comme sur
-- tout libellé non résolu (ADR-033 D4).
--
-- Impact runtime (vérifié sur `main` au 2026-10-05) : le moteur lit les symptômes
-- en `select('*')` et les valide par `DiagSymptomRowSchema`, un `z.object` non
-- strict qui ignore une clé inconnue ; `GET /api/diagnostic-engine/symptoms`
-- projette slug, label, description et urgency. La colonne n'est donc ni rejetée
-- ni exposée. Aucune vue ni fonction ne renvoie le type ligne de la table ;
-- anon et authenticated n'ont aucun droit sur elle (RLS active).
--
-- Additive · idempotente (ADD COLUMN IF NOT EXISTS ; la contrainte n'est créée
-- qu'avec la colonne) · réversible (.down.sql, rien à perdre tant qu'aucun alias
-- n'est écrit). Pas de BEGIN/COMMIT (squawk assume_in_transaction=true ; le
-- runner encadre la transaction).
-- Taille : 62 lignes, 128 kB (2026-10-05). Défaut constant → pas de réécriture de
-- table ; la contrainte est vérifiée sur ces 62 lignes sous le verrou.
-- =====================================================

set lock_timeout = '5s';
set statement_timeout = '60s';

ALTER TABLE public.__diag_symptom
  ADD COLUMN IF NOT EXISTS label_aliases text[] NOT NULL DEFAULT '{}'::text[]
    -- CASE : PostgreSQL ne garantit pas l'ordre d'évaluation d'un AND, et
    -- array_position lève une erreur sur un tableau à plusieurs dimensions.
    CONSTRAINT __diag_symptom_label_aliases_shape CHECK (
      CASE
        WHEN coalesce(array_ndims(label_aliases), 1) = 1
          THEN array_position(label_aliases, NULL) IS NULL
           AND array_position(label_aliases, ''::text) IS NULL
        ELSE false
      END
    );

COMMENT ON COLUMN public.__diag_symptom.label_aliases IS
  'ADR-033 D4 / ADR-112 : autres libellés du symptôme, résolus en slug par lookup '
  '(slug + label_aliases). Écrit uniquement par migration relue. Unicité entre '
  'lignes vérifiée par le consommateur D4, qui bloque sur tout alias ambigu.';
