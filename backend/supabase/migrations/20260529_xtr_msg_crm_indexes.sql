-- @non_transactional
-- squawk-ignore-file ban-concurrent-index-creation-in-transaction
-- squawk-ignore-file require-timeout-settings
--
-- Migration: 20260529_xtr_msg_crm_indexes
-- Follow-up structurel de #784 (mini-CRM V0). Crée les 2 indexes partiels
-- DIFFÉRÉS dans la migration `20260528_xtr_msg_crm_v0`.
--
-- Pourquoi CONCURRENTLY ?
--   ___xtr_msg = 14.6M lignes / 10 GB (table legacy XTR). Un CREATE INDEX
--   non-concurrent acquiert un lock SHARE qui bloque tous les writes
--   pendant le build (potentiellement plusieurs minutes — incident risqué
--   sur table hot). CREATE INDEX CONCURRENTLY contourne le lock mais ne
--   peut pas s'exécuter dans une transaction → marqueur `-- @non_transactional`
--   (le runner `scripts/ci/apply-supabase-migration.py` passe alors en
--   autocommit, un statement par aller-retour). L'ancien marqueur
--   `-- supabase: no-transaction` (Supabase CLI) n'est PAS reconnu par ce
--   runner : la migration aurait été emballée dans BEGIN/COMMIT → SQLSTATE
--   25001 (A5, plan massdoc 2026-09-02 ; garde = `--lint-markers`).
--
-- État PROD constaté le 2026-09-02 (pg_index, lecture seule) : ce fichier
-- n'est PAS au ledger infra.schema_migrations ; `idx_xtr_msg_crm_status_active`
-- existe avec indisvalid = false (build CONCURRENTLY lancé hors runner et
-- interrompu), `idx_xtr_msg_crm_follow_up_due` n'existe pas. Un
-- `CREATE INDEX CONCURRENTLY IF NOT EXISTS` sur un nom déjà pris — même par un
-- index INVALIDE — est un no-op (NOTICE « already exists, skipping ») : sans
-- le DROP ci-dessous, la migration serait « appliquée » en laissant l'index
-- invalide en place. DROP INDEX CONCURRENTLY n'acquiert que
-- SHARE UPDATE EXCLUSIVE (pas de blocage des writes) et un index invalide
-- n'est jamais utilisé par le planner : retrait sans effet sur le runtime.
--
-- squawk `require-timeout-settings` ignoré à dessein : un statement_timeout
-- sur un build CONCURRENTLY de 5-20 min le tuerait en laissant… un index
-- invalide (exactement le défaut réparé ici). Seul lock_timeout est posé
-- (fail-fast si un lock est tenu, sans démarrer le build).
--
-- Durée typique : 5-20 minutes par index (CONCURRENTLY = 2 scans + suivi
-- des writes). N'occupe pas de lock bloquant → safe sur prod hot.
--
-- Rollback : companion .down.sql avec DROP INDEX CONCURRENTLY (symétrique
-- sur le lock side ; SHARE UPDATE EXCLUSIVE ne bloque pas les writes).

SET lock_timeout = '5s';

-- Réparation : retire l'index INVALIDE laissé par le build interrompu
-- (voir en-tête). No-op si l'index n'existe pas ou a déjà été réparé.
DROP INDEX CONCURRENTLY IF EXISTS idx_xtr_msg_crm_status_active;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_xtr_msg_crm_status_active
  ON ___xtr_msg (msg_crm_status, msg_date DESC)
  WHERE msg_crm_status IS NOT NULL
    AND msg_crm_status NOT IN ('won', 'lost');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_xtr_msg_crm_follow_up_due
  ON ___xtr_msg (msg_crm_next_follow_up_at)
  WHERE msg_crm_next_follow_up_at IS NOT NULL
    AND msg_crm_status IS NOT NULL
    AND msg_crm_status NOT IN ('won', 'lost');

COMMENT ON INDEX idx_xtr_msg_crm_status_active IS
  'Mini-CRM V0 : couvre /admin/leads (filtre status, tri msg_date DESC). Partiel sur leads actifs (NOT IN won, lost) pour minimiser la taille.';

COMMENT ON INDEX idx_xtr_msg_crm_follow_up_due IS
  'Mini-CRM V0 : couvre filtre follow_up=due|overdue. Partiel sur leads actifs avec date de relance planifiée.';
