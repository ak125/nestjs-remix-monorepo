-- squawk-ignore-file require-concurrent-index-creation
--   Justification : les 2 indexes ci-dessous sont partiels (excluent NULL legacy
--   et statuts terminaux won/lost), construits sur un sous-ensemble réduit des
--   lignes de ___xtr_msg. Le lock SHARE acquis pendant le build est court.
--   Surface admin-only, hors hot-path SEO/funnel. CREATE INDEX CONCURRENTLY
--   exigerait de sortir du transaction wrapper Supabase (assume_in_transaction
--   = true dans .squawk.toml) et d'avoir 2 fichiers séparés — trade-off non
--   justifié pour V0 sur cette taille de données. Cf. précédent
--   20260120_rm_expression_index.sql qui suit le même choix.

-- Migration: 20260528_xtr_msg_crm_v0
-- Mini-CRM V0 — extension additive de ___xtr_msg pour suivi commercial des contacts.
--
-- Périmètre : ajoute 7 colonnes structurées préfixées `msg_crm_*`, une CHECK
-- contrainte enum sur le status, deux index partiels et un trigger BEFORE UPDATE
-- pour maintenir `msg_crm_updated_at`. Strictement additif et réversible
-- (cf. companion 20260528_xtr_msg_crm_v0.down.sql).
--
-- Pourquoi `msg_crm_status` est NULLABLE (et non DEFAULT 'new') :
--   ___xtr_msg contient l'historique legacy de tickets support (déjà fermés,
--   classés). Un DEFAULT 'new' marquerait toutes ces lignes legacy comme
--   "leads à traiter" — l'admin verrait un faux backlog. NULL = "non tracké
--   par le CRM" → seuls les nouveaux contacts via ContactService écrivent
--   explicitement status='new'.

-- ────────────────────────────────────────────────────────────────────────────
-- 1) Colonnes structurées CRM (additif, NULL-safe pour lignes legacy)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE ___xtr_msg
  ADD COLUMN IF NOT EXISTS msg_crm_status            TEXT,
  ADD COLUMN IF NOT EXISTS msg_crm_source_page       TEXT,
  ADD COLUMN IF NOT EXISTS msg_crm_vehicle_info      TEXT,
  ADD COLUMN IF NOT EXISTS msg_crm_part_requested    TEXT,
  ADD COLUMN IF NOT EXISTS msg_crm_next_follow_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS msg_crm_internal_note     TEXT,
  ADD COLUMN IF NOT EXISTS msg_crm_updated_at        TIMESTAMPTZ;

-- ────────────────────────────────────────────────────────────────────────────
-- 2) Invariant enum (CHECK) — NULL toléré pour les lignes legacy non-CRM
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE ___xtr_msg DROP CONSTRAINT IF EXISTS chk_msg_crm_status;
ALTER TABLE ___xtr_msg
  ADD CONSTRAINT chk_msg_crm_status
  CHECK (
    msg_crm_status IS NULL
    OR msg_crm_status IN ('new', 'contacted', 'quoted', 'won', 'lost')
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 3) Index partiels — lectures admin sur leads actifs uniquement
--    NULL NOT IN (...) renvoie NULL (≠ TRUE) ; les lignes legacy sont donc
--    automatiquement exclues des index, sans coût d'écriture.
-- ────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_xtr_msg_crm_status_active
  ON ___xtr_msg (msg_crm_status, msg_date DESC)
  WHERE msg_crm_status IS NOT NULL
    AND msg_crm_status NOT IN ('won', 'lost');

CREATE INDEX IF NOT EXISTS idx_xtr_msg_crm_follow_up_due
  ON ___xtr_msg (msg_crm_next_follow_up_at)
  WHERE msg_crm_next_follow_up_at IS NOT NULL
    AND msg_crm_status IS NOT NULL
    AND msg_crm_status NOT IN ('won', 'lost');

-- ────────────────────────────────────────────────────────────────────────────
-- 4) Trigger touch — maintient msg_crm_updated_at à chaque write CRM
--    Choix V0-propre (pas V0-ultra-minimal) : permet tri par activité dans
--    /admin/leads sans dépendre de msg_open/msg_close du flow legacy support.
--    Fonction marquée VOLATILE car elle écrit (cf. PostgREST STABLE-write gotcha).
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_xtr_msg_touch_crm_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
VOLATILE AS $$
BEGIN
  IF (
    NEW.msg_crm_status,
    NEW.msg_crm_source_page,
    NEW.msg_crm_vehicle_info,
    NEW.msg_crm_part_requested,
    NEW.msg_crm_next_follow_up_at,
    NEW.msg_crm_internal_note
  ) IS DISTINCT FROM (
    OLD.msg_crm_status,
    OLD.msg_crm_source_page,
    OLD.msg_crm_vehicle_info,
    OLD.msg_crm_part_requested,
    OLD.msg_crm_next_follow_up_at,
    OLD.msg_crm_internal_note
  ) THEN
    NEW.msg_crm_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_xtr_msg_touch_crm_updated_at ON ___xtr_msg;
CREATE TRIGGER trg_xtr_msg_touch_crm_updated_at
  BEFORE UPDATE ON ___xtr_msg
  FOR EACH ROW EXECUTE FUNCTION fn_xtr_msg_touch_crm_updated_at();

-- ────────────────────────────────────────────────────────────────────────────
-- 5) Documentation inline (lit-rapidement via \d+ ___xtr_msg)
-- ────────────────────────────────────────────────────────────────────────────
COMMENT ON COLUMN ___xtr_msg.msg_crm_status IS
  'Lead lifecycle. NULL = ligne legacy non-trackée. Sinon ∈ (new, contacted, quoted, won, lost). Voir packages/database-types/src/leads.ts.';
COMMENT ON COLUMN ___xtr_msg.msg_crm_source_page IS
  'Page où le formulaire de contact a été soumis (document.referrer ou null si direct).';
COMMENT ON COLUMN ___xtr_msg.msg_crm_vehicle_info IS
  'Représentation textuelle "Brand Model Year" extraite du payload vehicleInfo à l''INSERT.';
COMMENT ON COLUMN ___xtr_msg.msg_crm_part_requested IS
  'Pièce demandée par le client. NULL à la création — rempli par l''admin sur la fiche lead.';
COMMENT ON COLUMN ___xtr_msg.msg_crm_next_follow_up_at IS
  'Horodatage de prochaine relance commerciale planifiée.';
COMMENT ON COLUMN ___xtr_msg.msg_crm_internal_note IS
  'Note libre interne, non visible côté client.';
COMMENT ON COLUMN ___xtr_msg.msg_crm_updated_at IS
  'Auto-maintenu par trg_xtr_msg_touch_crm_updated_at à chaque write CRM.';
