-- Rollback: 20260907_xtr_msg_crm_indexes_align_to_leads_query
-- Restaure les prédicats de 20260529 (leads actifs uniquement). Les statistiques
-- produites par l'ANALYZE ne sont pas « annulables » et n'ont pas à l'être :
-- une statistique fraîche n'est jamais une régression.
-- CONCURRENTLY : pas de verrou ACCESS EXCLUSIVE sur une table de 7,9 Go.
SET lock_timeout = 0;
SET statement_timeout = 0;

DROP INDEX CONCURRENTLY IF EXISTS idx_xtr_msg_crm_status_active;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_xtr_msg_crm_status_active
  ON ___xtr_msg (msg_crm_status, msg_date DESC)
  WHERE msg_crm_status IS NOT NULL
    AND msg_crm_status NOT IN ('won', 'lost');

DROP INDEX CONCURRENTLY IF EXISTS idx_xtr_msg_crm_follow_up_due;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_xtr_msg_crm_follow_up_due
  ON ___xtr_msg (msg_crm_next_follow_up_at)
  WHERE msg_crm_next_follow_up_at IS NOT NULL
    AND msg_crm_status IS NOT NULL
    AND msg_crm_status NOT IN ('won', 'lost');
