-- =============================================================================
-- cleanup-r1-transactional-drift-20260506.sql
-- =============================================================================
-- One-shot idempotent cleanup of 3 R1 slots whose `r1s_micro_seo_block` carries
-- the legacy transactional CTA template
--   "Commandez votre {X} en stock, livraison rapide 24-48h, paiement securise."
-- which violates `r1-router-validator.md` FORBIDDEN section (panier/stock/
-- promo/livraison/en stock as dominant lexicon).
--
-- Affected slots identified by `audit-r1-coverage.sql` Q3 snapshot 2026-05-06:
--   pg_id 128  | joint-chemise-de-cylindre
--   pg_id 3902 | injecteur
--   pg_id 792  | moteur-electrique-de-ventilateur
--
-- Replacement strategy: substitute the offending sentence with the canonical
-- router phrasing from `r1-content-batch.md` rule template (post-PR #321):
--   "Selection guidee par marque, modele et motorisation pour garantir la
--    compatibilite de votre {X}. Filtrez selon votre vehicule pour acceder
--    aux references adaptees."
--
-- Idempotency guard: each UPDATE includes a WHERE clause matching the EXACT
-- current text. Re-running this script after one successful application
-- updates 0 rows (safe).
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/seo/cleanup-r1-transactional-drift-20260506.sql
--
-- Reference: ADR-041 §2.C (vault), audit verification plan rev 2.
-- Companion: scripts/seo/audit-r1-coverage.sql Q3 (now refined to distinguish
-- functional `commander` from transactional `Commandez votre`).
-- =============================================================================

\echo '=== Pre-cleanup state ==='
SELECT r1s_pg_id,
       LENGTH(r1s_micro_seo_block) AS micro_len,
       (r1s_micro_seo_block ~ 'Commandez\s+votre') AS has_buy_cta
FROM __seo_r1_gamme_slots
WHERE r1s_pg_id IN ('128', '3902', '792')
ORDER BY r1s_pg_id;

BEGIN;

-- -----------------------------------------------------------------------------
-- Slot 1 — pg_id 128 (joint-chemise-de-cylindre)
-- -----------------------------------------------------------------------------
UPDATE __seo_r1_gamme_slots
SET r1s_micro_seo_block = '<p>Joint chemise de cylindre compatible avec votre vehicule — Elring et Victor Reinz sont les references premium pour les joints moteur. Febi et Ajusa offrent une qualite OES fiable, Ridex couvre les applications budget.</p>
<p>Joint chemise OE origine ou OES qualite : la reference exacte est indispensable — diametre exterieur de la chemise, materiau (EPDM ou silicone haute temperature) et nombre de joints par chemise varient selon le code moteur. Budget de 5 a 200 EUR l''unite selon la motorisation.</p>
<p>Selection guidee par marque, modele et motorisation pour garantir la compatibilite joint chemise avec votre vehicule. Filtrez selon votre vehicule pour acceder aux references adaptees.</p>'
WHERE r1s_pg_id = '128'
  AND r1s_micro_seo_block ~ 'Commandez votre joint chemise de cylindre en stock, livraison rapide 24-48h, paiement securise';

-- -----------------------------------------------------------------------------
-- Slot 2 — pg_id 3902 (injecteur)
-- -----------------------------------------------------------------------------
UPDATE __seo_r1_gamme_slots
SET r1s_micro_seo_block = '<p>Injecteur compatible avec votre vehicule — Bosch, Delphi et Denso sont fournisseurs de premier monte pour les injecteurs diesel common rail et essence injection directe. Siemens VDO et Pierburg completent la gamme pour les motorisations europeennes.</p>
<p>Injecteur OE origine ou OES qualite : la reference constructeur est non-negociable sur les moteurs common rail haute pression. L''injecteur reconditionne certifie constitue une option viable sur moteurs diesel a fort kilometrage. Budget de 50 a 400 EUR l''unite selon la motorisation.</p>
<p>Selection guidee par marque, modele et motorisation pour garantir la compatibilite injecteur avec votre vehicule (diesel ou essence). Filtrez selon votre vehicule pour acceder aux references adaptees.</p>'
WHERE r1s_pg_id = '3902'
  AND r1s_micro_seo_block ~ 'Commandez votre injecteur en stock, livraison rapide 24-48h, paiement securise';

-- -----------------------------------------------------------------------------
-- Slot 3 — pg_id 792 (moteur-electrique-de-ventilateur)
-- -----------------------------------------------------------------------------
UPDATE __seo_r1_gamme_slots
SET r1s_micro_seo_block = '<p>Moteur electrique de ventilateur compatible avec votre vehicule — Behr/Mahle et Valeo sont les references OEM pour les motoventilateurs. NRF et Gates couvrent la majorite du parc europeen, Febi et Ridex completent la gamme OES.</p>
<p>Motoventilateur OE origine ou OES qualite : le connecteur electrique, le nombre de broches et les dimensions sont specifiques au vehicule. Verifiez la presence de climatisation — les vehicules climatises utilisent souvent un moteur a deux vitesses ou a commande PWM. Budget de 80 a 350 EUR l''unite selon la motorisation.</p>
<p>Selection guidee par marque, modele et motorisation pour garantir la compatibilite motoventilateur avec votre vehicule. Filtrez selon votre vehicule pour acceder aux references adaptees.</p>'
WHERE r1s_pg_id = '792'
  AND r1s_micro_seo_block ~ 'Commandez votre moteur electrique de ventilateur en stock, livraison rapide 24-48h, paiement securise';

\echo '=== Post-cleanup verification ==='
-- Confirm zero buy-CTA remains in the 3 slots
SELECT r1s_pg_id,
       LENGTH(r1s_micro_seo_block) AS micro_len,
       (r1s_micro_seo_block ~ 'Commandez\s+votre') AS has_buy_cta,
       (r1s_micro_seo_block ~* '(\yen stock\y|livraison\s+rapide|paiement\s+securise)') AS has_forbidden_phrase
FROM __seo_r1_gamme_slots
WHERE r1s_pg_id IN ('128', '3902', '792')
ORDER BY r1s_pg_id;

\echo '=== Global drift count post-cleanup (Q3 refined) ==='
-- Refined drift detector: capital-imperative `Commandez votre` OR explicit
-- buy-CTA phrases. Excludes lowercase functional `commander`.
SELECT
  COUNT(*) AS total_with_drift,
  COUNT(*) FILTER (WHERE r1s_micro_seo_block ~ 'Commandez\s+votre')                       AS has_buy_cta,
  COUNT(*) FILTER (WHERE r1s_micro_seo_block ~* '\yen stock\y')                            AS has_en_stock,
  COUNT(*) FILTER (WHERE r1s_micro_seo_block ~* 'livraison\s+rapide')                      AS has_livraison_rapide,
  COUNT(*) FILTER (WHERE r1s_micro_seo_block ~* 'paiement\s+securise')                     AS has_paiement_securise
FROM __seo_r1_gamme_slots
WHERE r1s_micro_seo_block IS NOT NULL
  AND r1s_micro_seo_block ~ '(Commandez\s+votre|\yen stock\y|livraison\s+rapide|paiement\s+securise)';

-- COMMIT only after manual review of the verification output.
-- For automated runs, uncomment:
COMMIT;

-- =============================================================================
-- End of cleanup-r1-transactional-drift-20260506.sql
-- =============================================================================
