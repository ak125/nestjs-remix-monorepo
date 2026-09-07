-- @non_transactional
-- squawk-ignore-file ban-concurrent-index-creation-in-transaction
--   assume_in_transaction=true (.squawk.toml) : CONCURRENTLY est interdit DANS une
--   transaction, et le marqueur ci-dessus fait exécuter ce fichier en autocommit par
--   l'engine. Les deux vont ensemble (gate A5 `--lint-markers`).
--
-- Migration: aligner les index CRM de ___xtr_msg sur la requête réellement émise
-- Suite de 20260529_xtr_msg_crm_indexes (appliquée le 2026-09-07) : les deux index
-- existent, sont VALIDES — et ne servent AUCUN des plans de /admin/leads.
--
-- Deux causes racines, mesurées le 2026-09-07 (lecture seule, PROD) :
--
-- 1. PRÉDICAT JAMAIS IMPLIQUÉ. `leads.service.ts` filtre
--    `.not('msg_crm_status','is',null)` (+ `.eq('msg_crm_status', X)` optionnel,
--    + filtre relance optionnel), trie `.order('msg_date', desc)` et demande
--    `count: 'exact'`. Il n'émet JAMAIS `NOT IN ('won','lost')`. Un index partiel
--    n'est utilisable que si son prédicat est impliqué par celui de la requête :
--    `status IS NOT NULL` n'implique pas `status IS NOT NULL AND status NOT IN (…)`.
--    Les index sont donc inutilisables pour la liste par défaut et pour le count.
--    EXPLAIN observé : liste = `Index Scan Backward using idx____xtr_msg_msg_date`
--    (15 266 798 lignes, filtre appliqué après) ; count = `Parallel Seq Scan` sur
--    les 7,9 Go de heap, sous le `statement_timeout` de 60 s du rôle.
--
-- 2. AUCUNE STATISTIQUE. `pg_stats` ne contient AUCUNE ligne pour `msg_crm_status`
--    ni `msg_crm_next_follow_up_at` : les colonnes ont été ajoutées par
--    20260528_xtr_msg_crm_v0 et le dernier autoanalyze de la table date du
--    2026-02-17, AVANT leur existence. Le planificateur ignore donc que
--    `msg_crm_status IS NOT NULL` sélectionne 8 lignes sur 15,3 M et ne choisira
--    pas l'index même une fois le prédicat corrigé. L'autoanalyze ne corrigera
--    jamais cela seul : son seuil est de 50 + 10 % de 15,3 M ≈ 1,5 M modifications,
--    alors que le CRM en touche quelques-unes par semaine. D'où l'ANALYZE explicite
--    ci-dessous — c'est la moitié du correctif, pas un ornement.
--
-- Périmètre : les prédicats partiels sont alignés sur ce que le service implique.
-- Les CLÉS et l'intention des deux index sont préservées (liste triée par date,
-- relances dues) — aucune sémantique produit ne change, aucune requête n'est
-- réécrite. Mesure : 8 lignes actives (`status IS NOT NULL AND NOT IN ('won','lost')`).
-- Le total `status IS NOT NULL` n'a pas été compté : aucun index ne le couvre
-- aujourd'hui et un count ferait le seq scan de 7,9 Go décrit plus haut —
-- l'ANALYZE de cette migration produira précisément cette statistique.
--
-- Coût : ___xtr_msg = 7,9 Go de heap / 15,3 M lignes ; CONCURRENTLY = 2 balayages
-- de heap, ~54 s chacun (mesuré 2026-09-04) → ~2 min par index. Timeouts EXPLICITES
-- à 0 : un GUC omis hérite des 60 s du rôle `postgres` — c'est exactement ce qui a
-- tué 20260529 le 2026-09-04. `lock_timeout = 0` : les attentes internes de
-- CONCURRENTLY comptent contre lock_timeout, et tout bloqueur potentiel est
-- lui-même borné par le statement_timeout de son rôle. Le job CI borne le run.
-- DROP CONCURRENTLY avant chaque CREATE : un build interrompu laisse un index
-- INVALIDE que `CREATE … IF NOT EXISTS` sauterait en silence (leçon 20260529).
--
-- Test d'acceptation après application (EXPLAIN, sans ANALYZE) :
--   liste  → Index Scan using idx_xtr_msg_crm_status_active (pas de Seq Scan)
--   count  → Index Only Scan / Aggregate sur le même index (pas de Parallel Seq Scan)
SET lock_timeout = 0;
SET statement_timeout = 0;

DROP INDEX CONCURRENTLY IF EXISTS idx_xtr_msg_crm_status_active;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_xtr_msg_crm_status_active
  ON ___xtr_msg (msg_crm_status, msg_date DESC)
  WHERE msg_crm_status IS NOT NULL;

DROP INDEX CONCURRENTLY IF EXISTS idx_xtr_msg_crm_follow_up_due;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_xtr_msg_crm_follow_up_due
  ON ___xtr_msg (msg_crm_next_follow_up_at)
  WHERE msg_crm_next_follow_up_at IS NOT NULL
    AND msg_crm_status IS NOT NULL;

COMMENT ON INDEX idx_xtr_msg_crm_status_active IS
  'Mini-CRM V0 : couvre /admin/leads (liste, filtre status, count exact, tri msg_date DESC). Prédicat aligné 2026-09-07 sur ce que leads.service.ts implique reellement (msg_crm_status IS NOT NULL) — le NOT IN (won, lost) initial n''etait jamais implique par la requete, rendant l''index inutilisable.';

COMMENT ON INDEX idx_xtr_msg_crm_follow_up_due IS
  'Mini-CRM V0 : couvre le filtre follow_up=due|overdue. Prédicat aligné 2026-09-07 sur leads.service.ts (next_follow_up_at IS NOT NULL AND status IS NOT NULL).';

ANALYZE public.___xtr_msg (msg_crm_status, msg_crm_next_follow_up_at);
