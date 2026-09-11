-- Migration : extend seo_event_type ENUM avec 'seo.runtime.cwv_beacon_rejected'.
--
-- CWV Runtime Observability — rend OBSERVABLES les beacons refusés par
-- POST /api/seo/cwv/beacon, jusqu'ici renvoyés en 202 `{ ok: false }` sans trace :
-- corps absent, schéma invalide, page hors origine canonique. Le code les agrège
-- par raison et écrit une ligne par raison par intervalle (CwvBeaconService).
-- Réutilise __seo_event_log existant, sur le patron de 'seo.runtime.bot_cwv_beacon'
-- (canon feedback_no_external_canary_when_internal_observability_exists), dont la
-- valeur d'enum est née dans la même famille de migrations (20260526_seo_cwv_raw.sql).
--
-- Pattern idempotent NOT EXISTS (retry-safe), aligné sur
-- 20260625_seo_event_placeholder_unresolved_enum.sql — pas de schema change
-- __seo_event_log, juste une extension ENUM dans un DO bloc PL/pgSQL.
--
-- OWNER-GATE (déploiement) : cet ADD VALUE doit être appliqué à la DB partagée
-- AVANT le déploiement du code emitter. Sinon l'écriture de l'agrégat échoue —
-- fail-safe : le beacon répond comme avant, et chaque intervalle produit un
-- warning `[cwv_beacon_rejection] event=persist_failed` qui porte la raison et le
-- compte. Cf .claude/rules/deployment.md axe 4 (migrations DB non auto-appliquées
-- à la DB partagée).

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'seo.runtime.cwv_beacon_rejected'
          AND enumtypid = 'seo_event_type'::regtype
    ) THEN
        ALTER TYPE seo_event_type ADD VALUE 'seo.runtime.cwv_beacon_rejected';
    END IF;
END $$;
