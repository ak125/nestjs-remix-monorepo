-- ══════════════════════════════════════════════════════════
-- Diagnostic Engine — 2 symptoms freinage manquants (slugs FR canon)
-- ADR-033 + ADR-040 + plan deja-verifier-existant Phase 2
-- ══════════════════════════════════════════════════════════
--
-- Contexte : pilote Phase E (plaquette-de-frein.md) nécessite des slugs
-- __diag_symptom pour diagnostic_relations[]. La fiche originale avait
-- TENTÉ ces 2 slugs FR (distance_freinage_allongee, voyant_freinage_allume)
-- puis les avait retirés faute de slug DB existant. Cette migration crée
-- les 2 slugs canon FR pour débloquer la fiche.
--
-- Convention slug canon (cf. feedback_french_only_for_content.md +
-- système filtration : perte_puissance_filtration, voyant_huile,
-- surconsommation_carburant, odeur_habitacle) :
--   - FR snake_case obligatoire
--   - signal_mode = 'symptom_slugs' (cohérence freinage existant) ou
--     'customer_reported' (cohérence filtration existant)
--   - urgency = 'haute' (système safety-critical)
--
-- Hors scope cette migration (déjà existant en DB) :
--   - filtration system (id=11, créé migration 20260321)
--   - perte_puissance_filtration (id=55, FR canon pour symptômes filtration)
--     → filtre-a-air.md doit pointer vers ce slug, pas inventer
--
-- Note legacy à isoler (5 slugs brake_* en EN, drift batch 20260308) :
--   - brake_noise_grinding, brake_noise_metallic, brake_pulling_side,
--     brake_soft_pedal, brake_vibration_pedal
--   Ces slugs existants restent utilisés par plaquette-de-frein.md mais
--   tout NOUVEAU slug DOIT être FR (cf. règle FR-only).
--
-- Plan : /home/deploy/.claude/plans/deja-verifier-existant-de-abundant-hanrahan.md
-- ADR : governance-vault/ledger/decisions/adr/ADR-040-wiki-proposal-evidence-and-conditional-promotion.md

INSERT INTO __diag_symptom (slug, system_id, label, description, signal_mode, urgency, active)
VALUES
  ('distance_freinage_allongee',
   (SELECT id FROM __diag_system WHERE slug='freinage'),
   'Distance de freinage allongée',
   'Sensation de distance d''arrêt anormalement longue, pédale parfois plus enfoncée. Causes possibles : plaquettes usées/contaminées, disques voilés, ABS défaillant, liquide de frein vieillissant.',
   'symptom_slugs', 'haute', true),
  ('voyant_freinage_allume',
   (SELECT id FROM __diag_system WHERE slug='freinage'),
   'Voyant freinage allumé',
   'Témoin freinage rouge ou orange au tableau de bord. Causes possibles : niveau liquide bas, plaquettes en fin de vie (capteur d''usure), frein à main partiellement engagé, ABS défaillant.',
   'symptom_slugs', 'haute', true)
ON CONFLICT (slug) DO NOTHING;

-- Validation post-migration :
--   SELECT slug, label, signal_mode, urgency
--   FROM __diag_symptom
--   WHERE slug IN ('distance_freinage_allongee','voyant_freinage_allume');
--   -- attendu : 2 rows
