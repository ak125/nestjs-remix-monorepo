-- Timeouts défensifs avant DDL (squawk require-timeout-settings).
SET lock_timeout      = '5s';
SET statement_timeout = '60s';

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
-- 2) Invariant enum (CHECK) — NULL toléré pour les lignes legacy non-CRM.
--    Ajout en NOT VALID volontairement (squawk constraint-missing-not-valid) :
--    la colonne `msg_crm_status` vient d'être ajoutée ci-dessus, donc toutes
--    les lignes existantes ont NULL = valide par construction. Pas besoin de
--    VALIDATE CONSTRAINT (qui en plus, dans la même tx, bloquerait les reads
--    pour rien). La contrainte est enforced pour tous les INSERT/UPDATE
--    futurs ; les éventuelles backfills opérateurs ultérieures devront
--    lancer `ALTER TABLE ___xtr_msg VALIDATE CONSTRAINT chk_msg_crm_status`
--    en migration séparée (out-of-tx) si elles touchent à la colonne.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE ___xtr_msg DROP CONSTRAINT IF EXISTS chk_msg_crm_status;
ALTER TABLE ___xtr_msg
  ADD CONSTRAINT chk_msg_crm_status
  CHECK (
    msg_crm_status IS NULL
    OR msg_crm_status IN ('new', 'contacted', 'quoted', 'won', 'lost')
  ) NOT VALID;

-- ────────────────────────────────────────────────────────────────────────────
-- 3) Indexes : DIFFÉRÉS à une migration follow-up séparée
-- ────────────────────────────────────────────────────────────────────────────
--   ___xtr_msg = 14.6M lignes / 10 GB (table legacy XTR).
--   Construire `CREATE INDEX` non-concurrent ici prend >60s ET bloque les
--   writes pendant le scan → inacceptable. `CREATE INDEX CONCURRENTLY` ne
--   peut pas s'exécuter dans une transaction (toutes les migrations
--   Supabase sont transactionnelles). Donc les 2 indexes partiels seront
--   ajoutés via une migration follow-up dédiée `*_xtr_msg_crm_indexes`,
--   exécutée hors-tx (psql direct ou Supabase CLI avec marker no-transaction).
--
--   Acceptable en V0 : tant que msg_crm_status est ~100% NULL (uniquement
--   les nouveaux contacts soumis post-deploy sont marqués), la requête
--   admin `WHERE msg_crm_status IS NOT NULL` + LIMIT renvoie ~0 lignes et
--   le planner n'a pas à scanner massivement. À mesure que les leads
--   accumulent, ouvrir la migration follow-up.

-- ────────────────────────────────────────────────────────────────────────────
-- 4) Trigger touch — maintient msg_crm_updated_at à chaque write CRM
--    Choix V0-propre (pas V0-ultra-minimal) : permet tri par activité dans
--    /admin/leads sans dépendre de msg_open/msg_close du flow legacy support.
--    Fonction marquée VOLATILE car elle écrit (cf. PostgREST STABLE-write gotcha).
-- ────────────────────────────────────────────────────────────────────────────
-- `SET search_path = ''` durcit la fonction contre une injection search_path
-- (Supabase advisor function_search_path_mutable). Les seules références
-- externes — `now()` — sont qualifiées via pg_catalog.
CREATE OR REPLACE FUNCTION fn_xtr_msg_touch_crm_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
VOLATILE
SET search_path = ''
AS $$
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
    NEW.msg_crm_updated_at := pg_catalog.now();
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
