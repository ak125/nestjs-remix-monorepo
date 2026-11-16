-- scripts/audit/supplier-sale-report.sql
-- Rapport décision 51 (owner, 2026-11-15/16) — vente par fournisseur et par lot.
--
-- LECTURE SEULE : uniquement des SELECT. Aucune donnée client (ni commande, ni
-- client) : pieces_price, pieces, price_import_batches, pieces_price_history.
--
-- Définition de « vendable » (unique, décision 51 ; code :
-- backend/src/database/services/vendable.ts) :
--   pri_dispo = '1' AND pricing_state <> 'FROZEN' AND piece_display = true
--   AND pri_vente_ttc_n > 0
--
-- Sections :
--   1. pièces vendables en attente de mise à jour, par fournisseur (pri_frs) ;
--   2. entrées et sorties de vente par lot (pieces_price_history) ;
--   3. arrêts du garde-fou 5 % (operation DISPO_DEACTIVATION_GUARD_HALT) ;
--   4. détail d'un lot (psql -v batch_id=<uuid>), sinon ignoré.
--
-- Limites :
--   - « en attente » = ligne vendable sans aucune trace d'un lot gouverné
--     COMMITTED (pieces_price_history). Une ligne mise à jour avant le module
--     tarifaire (2026-05-22) compte comme en attente : c'est voulu, sa
--     provenance n'est pas prouvée.
--   - entrées/sorties = transitions de pri_dispo vers / depuis '1' enregistrées
--     par lot. L'historique ne garde ni pricing_state ni piece_display : un
--     masquage (display/quarantine) ou un gel n'y apparaissent pas.
--   - la date de fraîcheur par fournisseur vit dans le code
--     (backend/src/modules/pricing/config/supplier-sale-rules.ts) ; elle n'est
--     pas lisible ici.
--
-- Usage (DEV, lecture seule) :
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/audit/supplier-sale-report.sql
--   psql "$DATABASE_URL" -v batch_id=<uuid> -f scripts/audit/supplier-sale-report.sql

\echo '== 1. Pièces vendables en attente de mise à jour, par fournisseur (pri_frs)'
WITH vendable AS (
  SELECT pp.pri_piece_id_i, pp.pri_type, coalesce(pp.pri_frs, '(sans libellé)') AS frs
    FROM pieces_price pp
    JOIN pieces p ON p.piece_id = pp.pri_piece_id_i
   WHERE pp.pri_dispo = '1'
     AND coalesce(pp.pricing_state, '') <> 'FROZEN'
     AND p.piece_display = true
     AND pp.pri_vente_ttc_n > 0
),
trace AS (
  SELECT h.pri_piece_id_i, h.pri_type, max(h.created_at) AS derniere_maj
    FROM pieces_price_history h
    JOIN price_import_batches b ON b.batch_id = h.batch_id
   WHERE b.status = 'COMMITTED'
   GROUP BY 1, 2
)
SELECT v.frs                                             AS fournisseur,
       count(*)                                          AS vendables,
       count(*) FILTER (WHERE t.derniere_maj IS NULL)    AS en_attente_maj,
       round(100.0 * count(*) FILTER (WHERE t.derniere_maj IS NULL)
             / nullif(count(*), 0), 1)                   AS pct_en_attente,
       max(t.derniere_maj)::date                         AS derniere_maj_gouvernee
  FROM vendable v
  LEFT JOIN trace t
    ON t.pri_piece_id_i = v.pri_piece_id_i
   AND t.pri_type IS NOT DISTINCT FROM v.pri_type
 GROUP BY v.frs
 ORDER BY vendables DESC;

\echo '== 2. Entrées et sorties de vente par lot (transitions de pri_dispo)'
SELECT b.batch_id,
       b.started_at::date                                AS jour,
       b.supplier_id                                     AS marque_pm_id,
       coalesce(b.operation, 'IMPORT')                   AS operation,
       b.status,
       count(h.id)                                       AS lignes_tracees,
       count(h.id) FILTER (WHERE coalesce(h.old_dispo, '') <> '1'
                              AND h.new_dispo = '1')     AS entrees_vente,
       count(h.id) FILTER (WHERE h.old_dispo = '1'
                              AND coalesce(h.new_dispo, '') <> '1') AS sorties_vente
  FROM price_import_batches b
  LEFT JOIN pieces_price_history h ON h.batch_id = b.batch_id
 GROUP BY b.batch_id, b.started_at, b.supplier_id, b.operation, b.status
 ORDER BY b.started_at DESC
 LIMIT 100;

\echo '== 3. Arrêts du garde-fou 5 % (lot FAILED, attend l accord de l owner)'
SELECT b.batch_id                                        AS halt_batch_id,
       b.started_at,
       b.supplier_id                                     AS marque_pm_id,
       b.failed_rows                                     AS sorties_projetees,
       b.status,
       EXISTS (
         SELECT 1 FROM price_import_batches c
          WHERE c.supplier_id = b.supplier_id
            AND c.operation = 'DISPO_DEACTIVATION'
            AND c.started_at > b.started_at
       )                                                 AS lot_retrait_posterieur
  FROM price_import_batches b
 WHERE b.operation = 'DISPO_DEACTIVATION_GUARD_HALT'
 ORDER BY b.started_at DESC;

\if :{?batch_id}
\echo '== 4. Détail du lot' :'batch_id'
SELECT h.pri_piece_id_i                                  AS piece_id,
       h.pri_type,
       h.operation,
       h.old_dispo, h.new_dispo,
       h.old_achat_ht, h.new_achat_ht,
       h.old_vente_ttc, h.new_vente_ttc,
       CASE
         WHEN coalesce(h.old_dispo, '') <> '1' AND h.new_dispo = '1' THEN 'ENTREE'
         WHEN h.old_dispo = '1' AND coalesce(h.new_dispo, '') <> '1' THEN 'SORTIE'
         ELSE ''
       END                                               AS mouvement_vente
  FROM pieces_price_history h
 WHERE h.batch_id = :'batch_id'::uuid
 ORDER BY mouvement_vente DESC, h.pri_piece_id_i
 LIMIT 5000;
\else
\echo '== 4. Détail d un lot : relancer avec -v batch_id=<uuid> (section 2)'
\endif
