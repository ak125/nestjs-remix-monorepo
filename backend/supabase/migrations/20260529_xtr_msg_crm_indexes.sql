-- supabase: no-transaction
-- squawk-ignore-file ban-concurrent-index-creation-in-transaction
-- squawk-ignore-file require-timeout-settings
--
-- Migration: 20260529_xtr_msg_crm_indexes
-- Follow-up structurel de #784 (mini-CRM V0). Crée les 2 indexes partiels
-- DIFFÉRÉS dans la migration `20260528_xtr_msg_crm_v0`.
--
-- Pourquoi maintenant et pas avant ?
--   ___xtr_msg = 14.6M lignes / 10 GB (table legacy XTR). Un CREATE INDEX
--   non-concurrent acquiert un lock SHARE qui bloque tous les writes
--   pendant le build (potentiellement plusieurs minutes — incident risqué
--   sur table hot). CREATE INDEX CONCURRENTLY contourne le lock mais ne
--   peut pas s'exécuter dans une transaction.
--
-- ⚠️  CONTRAINTES D'APPLICATION :
--   • PEUT PAS être appliquée via Supabase MCP `apply_migration` (wrap tx).
--   • PEUT PAS être appliquée via une migration runner standard si celui-ci
--     emballe en transaction.
--   • Application correcte (2 voies équivalentes) :
--       1. Supabase CLI qui respecte le marker `-- supabase: no-transaction`
--          en tête : `supabase db push`
--       2. psql direct : `psql "$DATABASE_URL" -f \
--          backend/supabase/migrations/20260529_xtr_msg_crm_indexes.sql`
--   • Durée typique : 5-20 minutes (CONCURRENTLY = 2 scans + suivi writes).
--     N'occupe pas de lock bloquant → safe sur prod hot.
--
-- Rollback : companion .down.sql avec DROP INDEX CONCURRENTLY (symétrique
-- sur le lock side ; SHARE UPDATE EXCLUSIVE ne bloque pas les writes).

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_xtr_msg_crm_status_active
  ON ___xtr_msg (msg_crm_status, msg_date DESC)
  WHERE msg_crm_status IS NOT NULL
    AND msg_crm_status NOT IN ('won', 'lost');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_xtr_msg_crm_follow_up_due
  ON ___xtr_msg (msg_crm_next_follow_up_at)
  WHERE msg_crm_next_follow_up_at IS NOT NULL
    AND msg_crm_status IS NOT NULL
    AND msg_crm_status NOT IN ('won', 'lost');

-- Documentation inline (visible via \d+ ___xtr_msg).
COMMENT ON INDEX idx_xtr_msg_crm_status_active IS
  'Mini-CRM V0 : couvre /admin/leads (filtre status, tri msg_date DESC). Partiel sur leads actifs (NOT IN won, lost) pour minimiser la taille.';
COMMENT ON INDEX idx_xtr_msg_crm_follow_up_due IS
  'Mini-CRM V0 : couvre filtre follow_up=due|overdue. Partiel sur leads actifs avec date de relance planifiée.';
