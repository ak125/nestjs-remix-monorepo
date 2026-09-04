-- @non_transactional
-- squawk-ignore-file ban-concurrent-index-creation-in-transaction
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
-- TIMEOUTS — corrigé après l'incident du 2026-09-04 (run 33839602437).
-- Ce fichier portait `-- squawk-ignore-file require-timeout-settings`. Il est
-- RETIRÉ : la règle qu'il faisait taire est exactement celle qui aurait prédit
-- l'incident — « Missing `set statement_timeout` before potentially slow
-- operations », pointant le DROP INDEX CONCURRENTLY. Vérifié avec la version
-- utilisée par la CI (squawk 2.52.1, cf. ci.yml) : sans le SET ci-dessous la
-- règle lève et sort en rc=1 ; avec lui, 0 problème. Un garde juste, réduit au
-- silence par une justification fausse.
-- La version précédente de cet en-tête raisonnait ainsi : « ne pas poser de
-- statement_timeout, sinon il tuerait le build CONCURRENTLY ». Le raisonnement
-- est faux, et c'est lui qui a produit l'incident : NE PAS poser la valeur ne
-- veut pas dire « aucun timeout », cela veut dire HÉRITER celle du rôle. Sur ce
-- projet Supabase, `ALTER ROLE postgres SET statement_timeout` vaut 60 s — et le
-- runner se connecte précisément comme `postgres` :
--   SELECT setconfig FROM pg_db_role_setting s JOIN pg_roles r ON r.oid=s.setrole
--    WHERE r.rolname='postgres';   -->  {search_path=…, statement_timeout=60s}
-- Le run a donc été tué à 60,588 s (`QueryCanceled`), laissant l'index en
-- indisvalid=false — exactement le défaut que ce fichier répare.
-- 60 s n'auraient jamais suffi : un parcours complet du heap de ___xtr_msg est
-- mesuré à ~54 s (40 000 pages en 2 305 ms sur 935 631 pages), et un
-- CREATE INDEX CONCURRENTLY en fait DEUX par index.
-- D'où `statement_timeout = 0` EXPLICITE ci-dessous. La borne extérieure reste
-- le `timeout-minutes: 20` du job (~4 min de parcours pour les deux index :
-- confortable). `reset_session()` (#1388) restaure le défaut du rôle avant la
-- migration suivante — la levée ne fuit pas.
-- `lock_timeout` reste à 5 s : fail-fast si un verrou est tenu, sans démarrer
-- le build.
--
-- Durée attendue : ~2 min par index. Mesure du 2026-09-04 (EXPLAIN ANALYZE,
-- BUFFERS sur une plage de ctid) : 40 000 pages lues à froid en 2 305 ms, soit
-- ~54 s pour les 935 631 pages du heap ; CONCURRENTLY en fait 2 par index, plus
-- l'attente des transactions concurrentes. L'estimation « 5-20 min » d'origine
-- n'était pas mesurée. N'occupe aucun lock bloquant → safe sur prod hot.
--
-- Rollback : companion .down.sql avec DROP INDEX CONCURRENTLY (symétrique
-- sur le lock side ; SHARE UPDATE EXCLUSIVE ne bloque pas les writes).

SET lock_timeout = '5s';
-- Explicite, et non omis : voir l'en-tête. 0 = pas de limite pour CETTE session.
SET statement_timeout = 0;

-- Réparation : retire l'index INVALIDE laissé par le build interrompu
-- (voir en-tête). No-op si l'index n'existe pas ou a déjà été réparé.
DROP INDEX CONCURRENTLY IF EXISTS idx_xtr_msg_crm_status_active;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_xtr_msg_crm_status_active
  ON ___xtr_msg (msg_crm_status, msg_date DESC)
  WHERE msg_crm_status IS NOT NULL
    AND msg_crm_status NOT IN ('won', 'lost');

-- Garde de reprise, symetrique de celle posee sur `status_active`. No-op
-- aujourd'hui : `follow_up_due` n'existe pas. Elle couvre l'interruption du
-- build ci-dessous : le job d'application est plafonne a `timeout-minutes: 20`
-- (.github/workflows/apply-supabase-migrations.yml) alors que l'en-tete annonce
-- 5-20 min PAR index. Un build interrompu laisse l'index INVALIDE ; la relance
-- verrait le nom pris et `CREATE ... IF NOT EXISTS` serait un no-op silencieux
-- -> migration « appliquee » avec un index inutilisable. C'est exactement le
-- defaut repare plus haut, un index plus loin. Le `.down.sql` portait deja les
-- deux DROP ; cette ligne retablit la symetrie cote up.
DROP INDEX CONCURRENTLY IF EXISTS idx_xtr_msg_crm_follow_up_due;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_xtr_msg_crm_follow_up_due
  ON ___xtr_msg (msg_crm_next_follow_up_at)
  WHERE msg_crm_next_follow_up_at IS NOT NULL
    AND msg_crm_status IS NOT NULL
    AND msg_crm_status NOT IN ('won', 'lost');

COMMENT ON INDEX idx_xtr_msg_crm_status_active IS
  'Mini-CRM V0 : couvre /admin/leads (filtre status, tri msg_date DESC). Partiel sur leads actifs (NOT IN won, lost) pour minimiser la taille.';

COMMENT ON INDEX idx_xtr_msg_crm_follow_up_due IS
  'Mini-CRM V0 : couvre filtre follow_up=due|overdue. Partiel sur leads actifs avec date de relance planifiée.';
