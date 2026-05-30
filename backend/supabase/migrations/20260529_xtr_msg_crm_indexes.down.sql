-- supabase: no-transaction
--
-- Rollback: 20260529_xtr_msg_crm_indexes
-- DROP INDEX CONCURRENTLY pour éviter le lock ACCESS EXCLUSIVE sur ___xtr_msg.
-- Acquiert seulement SHARE UPDATE EXCLUSIVE → ne bloque pas les writes.

DROP INDEX CONCURRENTLY IF EXISTS idx_xtr_msg_crm_follow_up_due;
DROP INDEX CONCURRENTLY IF EXISTS idx_xtr_msg_crm_status_active;
