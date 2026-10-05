-- =====================================================
-- ROLLBACK MANUEL de 20261005_diag_symptom_label_aliases.sql
-- (ignoré par le runner — forward-only ; intervention opérateur uniquement)
-- =====================================================
-- Perte : les alias écrits depuis l'application. Avant le consommateur D4
-- (phase 3), la colonne est vide : rien n'est perdu. Après, revenir d'abord le
-- code qui la lit.
-- La contrainte `__diag_symptom_label_aliases_shape` part avec la colonne.
-- =====================================================

set lock_timeout = '5s';
set statement_timeout = '60s';

ALTER TABLE public.__diag_symptom DROP COLUMN IF EXISTS label_aliases;
