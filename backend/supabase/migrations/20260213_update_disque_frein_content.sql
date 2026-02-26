-- ============================================================================
-- APPLY: Upgrade contenu disque de frein (pg_id=82)
-- ============================================================================
-- Origine:
--   Version persistante du dry-run:
--   backend/supabase/dry-run/20260213_disque_frein_content_dry_run.sql
--
-- Objectif:
--   Renforcer la qualité éditoriale des sections contrat:
--   intro, risk, timing, arguments, howToChoose, symptoms, faq.
--   Ce script est CONTENT-ONLY (pas de DDL, pas de provenance source).
--
-- Date: 2026-02-13
-- ============================================================================

UPDATE __seo_gamme_purchase_guide
SET
  sgpg_intro_title = 'Les disques de frein',
  sgpg_intro_role = 'Pour éviter une erreur d''achat, validez d''abord l''essieu (avant/arrière), les dimensions (diamètre, épaisseur, entraxe) et le type de disque (plein/ventilé). Un disque incompatible ou usé allonge la distance de freinage et dégrade la sécurité.',
  sgpg_intro_sync_parts = ARRAY[
    'les plaquettes de frein',
    'les étriers',
    'le liquide de frein'
  ],

  sgpg_risk_title = 'Pourquoi ne pas attendre ou commander "au hasard" ?',
  sgpg_risk_explanation = 'Deux risques coûtent cher: rouler avec des disques usés et commander une mauvaise référence. Dans les deux cas, la distance de freinage peut augmenter, les vibrations apparaissent et vous cumulez pièces, temps et main-d''œuvre.',
  sgpg_risk_consequences = ARRAY[
    'distance de freinage allongée en situation d''urgence',
    'vibrations au volant et à la pédale',
    'erreur d''essieu ou de dimensions = pièce non montable',
    'facture plus élevée entre retour, immobilisation et seconde commande'
  ],
  sgpg_risk_cost_range = '150 à 900 EUR selon véhicule et marque choisie',
  sgpg_risk_conclusion = 'Remplacer les disques au bon moment protège votre sécurité et votre budget.',

  sgpg_timing_title = 'Quand changer les disques de frein ?',
  sgpg_timing_years = 'contrôle visuel à chaque révision',
  sgpg_timing_km = 'souvent entre 60 000 et 80 000 km selon usage',
  sgpg_timing_note = 'Remplacez sans attendre en cas de vibration, surchauffe, rainures profondes ou épaisseur sous la cote minimale gravée sur le disque.',

  sgpg_arg1_title = 'Anti-erreur de référence',
  sgpg_arg1_content = 'Filtrage par véhicule + contrôle essieu/dimensions pour éviter les incompatibilités au montage.',
  sgpg_arg1_icon = 'check-circle',
  sgpg_arg2_title = 'Choix selon votre usage',
  sgpg_arg2_content = 'Conduite urbaine, mixte ou soutenue: choisissez le bon disque sans surpayer des spécifications inutiles.',
  sgpg_arg2_icon = 'shield-check',
  sgpg_arg3_title = 'Sécurité de freinage prioritaire',
  sgpg_arg3_content = 'Remplacement par paire sur le même essieu et recommandations de montage claires.',
  sgpg_arg3_icon = 'list-check',
  sgpg_arg4_title = 'Passage rapide à la sélection',
  sgpg_arg4_content = 'Après validation, basculez vers les compatibilités filtrées de votre véhicule pour commander sans doute.',
  sgpg_arg4_icon = 'clock',

  sgpg_how_to_choose = '1) Renseignez votre véhicule. 2) Vérifiez l''essieu concerné (avant/arrière). 3) Contrôlez diamètre, épaisseur et entraxe. 4) Choisissez plein ou ventilé selon usage. 5) Commandez toujours par paire sur le même essieu, idéalement avec des plaquettes neuves.',
  sgpg_symptoms = ARRAY[
    'vibrations au volant lors du freinage',
    'pulsations nettes dans la pédale de frein',
    'bruit métallique au freinage ou au relâchement',
    'rainures, fissures ou bleuissement visibles sur la piste',
    'distance de freinage qui augmente à usage égal'
  ],
  sgpg_faq = '[
    {
      "question": "Comment choisir un disque de frein compatible ?",
      "answer": "Sélectionnez le véhicule, puis validez l''essieu et les dimensions (diamètre, épaisseur, entraxe/hauteur) avant commande."
    },
    {
      "question": "Faut-il remplacer avant et arrière en même temps ?",
      "answer": "Non, remplacez l''essieu concerné. En revanche, sur le même essieu, les disques se remplacent toujours par paire."
    },
    {
      "question": "Faut-il changer les plaquettes en même temps que les disques ?",
      "answer": "Oui, c''est recommandé pour conserver un freinage homogène, limiter le bruit et éviter une usure irrégulière."
    },
    {
      "question": "Quel est le bon moment pour remplacer les disques ?",
      "answer": "Dès symptômes (vibrations, bruit, distance de freinage en hausse) ou dès que l''épaisseur passe sous la cote minimale constructeur."
    }
  ]'::jsonb,
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '82';
