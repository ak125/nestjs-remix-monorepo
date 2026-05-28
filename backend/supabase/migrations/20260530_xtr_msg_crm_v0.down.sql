-- Rollback: 20260530_xtr_msg_crm_v0
-- Réversibilité complète du Mini-CRM V0. Pas de perte de donnée legacy
-- (msg_crm_* sont des colonnes ajoutées par 20260530_xtr_msg_crm_v0.sql).

DROP TRIGGER IF EXISTS trg_xtr_msg_touch_crm_updated_at ON ___xtr_msg;
DROP FUNCTION IF EXISTS fn_xtr_msg_touch_crm_updated_at();

DROP INDEX IF EXISTS idx_xtr_msg_crm_follow_up_due;
DROP INDEX IF EXISTS idx_xtr_msg_crm_status_active;

ALTER TABLE ___xtr_msg DROP CONSTRAINT IF EXISTS chk_msg_crm_status;

ALTER TABLE ___xtr_msg
  DROP COLUMN IF EXISTS msg_crm_updated_at,
  DROP COLUMN IF EXISTS msg_crm_internal_note,
  DROP COLUMN IF EXISTS msg_crm_next_follow_up_at,
  DROP COLUMN IF EXISTS msg_crm_part_requested,
  DROP COLUMN IF EXISTS msg_crm_vehicle_info,
  DROP COLUMN IF EXISTS msg_crm_source_page,
  DROP COLUMN IF EXISTS msg_crm_status;
