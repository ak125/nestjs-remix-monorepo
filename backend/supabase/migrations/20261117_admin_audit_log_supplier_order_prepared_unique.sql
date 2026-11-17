-- @non_transactional
-- squawk-ignore-file ban-concurrent-index-creation-in-transaction
--   assume_in_transaction=true (.squawk.toml) : CONCURRENTLY est interdit DANS une
--   transaction ; le marqueur ci-dessus fait exécuter ce fichier en autocommit par
--   l'engine. Les deux vont ensemble (gate `--lint-markers`, README §Non-transactional).
-- =============================================================================
-- Migration : une seule commande fournisseur préparée par ligne de commande
-- Date      : 2026-11-17 (mandat BK, contrôle 4 de la décision de Marwane du
--             17/11/2026 18:04 : « une commande fournisseur par ligne, pas de
--             doublon sur double clic ou reprise »)
-- Scope     : public.__admin_audit_log, un index unique PARTIEL. Aucune ligne
--             écrite, aucune colonne ajoutée, aucune RLS modifiée.
-- Forward-only. Ne réécrit AUCUNE migration historique.
-- =============================================================================
--
-- POURQUOI : SupplierOrderPreparationService (backend/src/modules/orders/
-- services/supplier-order-preparation.service.ts) trace chaque commande
-- fournisseur préparée par une ligne aal_action = 'supplier_order_prepared',
-- aal_entity_type = 'order_line', aal_entity_id = orl_id. Il refuse déjà un
-- second clic (lecture préalable + verrou en mémoire), mais deux processus
-- backend simultanés pourraient chacun écrire. Cet index rend le doublon
-- impossible en base ; le service traduit la violation (23505) en
-- « DEJA_PREPAREE ».
--
-- PÉRIMÈTRE (relevé en lecture seule le 2026-11-17, base DEV partagée) :
-- __admin_audit_log = 78 lignes, 104 kB ; 0 ligne aal_entity_type = 'order_line'
-- → l'index se crée sans conflit et en quelques millisecondes. CONCURRENTLY
-- est tout de même retenu : c'est la convention du dépôt (squawk
-- require-concurrent-index-creation) et il ne bloque pas les écritures du
-- journal d'audit pendant la construction.
--
-- REPRISE : un CREATE INDEX CONCURRENTLY interrompu laisse un index INVALIDE
-- qu'un `IF NOT EXISTS` ignorerait. Le DROP CONCURRENTLY qui précède le retire
-- (README §Non-transactional, comme 20260529_xtr_msg_crm_indexes).
-- TIMEOUTS explicites à 0 : sans eux, le rôle `postgres` impose 60 s
-- (incident du 2026-09-04) ; CONCURRENTLY attend les transactions en cours et
-- ces attentes compteraient contre lock_timeout. La borne extérieure est le
-- `timeout-minutes` du job.
--
-- APPLICATION : réservée à Marwane, workflow « Apply Supabase migrations
-- (manual) ». Sans cet index, le service reste correct dans un seul processus
-- (verrou en mémoire + lecture préalable).
SET lock_timeout = 0;
SET statement_timeout = 0;

DROP INDEX CONCURRENTLY IF EXISTS public.uq_aal_supplier_order_prepared_line;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_aal_supplier_order_prepared_line
  ON public.__admin_audit_log (aal_entity_type, aal_entity_id)
  WHERE aal_action = 'supplier_order_prepared';
