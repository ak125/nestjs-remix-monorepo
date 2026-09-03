-- @non_transactional
--
-- Rollback: 20260529_xtr_msg_crm_indexes
-- DROP INDEX CONCURRENTLY pour éviter le lock ACCESS EXCLUSIVE sur ___xtr_msg.
-- Acquiert seulement SHARE UPDATE EXCLUSIVE → ne bloque pas les writes.
-- (Fichier .down.sql : ignoré par le runner forward-only et par squawk ;
-- marqueur aligné sur le forward pour la cohérence de la convention.)

DROP INDEX CONCURRENTLY IF EXISTS idx_xtr_msg_crm_follow_up_due;
DROP INDEX CONCURRENTLY IF EXISTS idx_xtr_msg_crm_status_active;
