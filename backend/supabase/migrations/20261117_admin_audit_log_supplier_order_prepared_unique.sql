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
-- → l'index se crée sans conflit et en quelques millisecondes ; pas besoin
-- de CONCURRENTLY.
--
-- APPLICATION : réservée à Marwane, workflow « Apply Supabase migrations
-- (manual) ». Sans cet index, le service reste correct dans un seul processus
-- (verrou en mémoire + lecture préalable).
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_temp;

CREATE UNIQUE INDEX IF NOT EXISTS uq_aal_supplier_order_prepared_line
  ON public.__admin_audit_log (aal_entity_type, aal_entity_id)
  WHERE aal_action = 'supplier_order_prepared';

COMMIT;
