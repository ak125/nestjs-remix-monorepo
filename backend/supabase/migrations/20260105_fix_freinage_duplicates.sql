-- Migration: Correction des doublons de contenu SEO pour la famille Freinage
-- Date: 2026-01-05
-- Problème: Les 4 gammes freinage (402, 82, 78, 407) avaient le même texte pour risk_explanation, risk_consequences, risk_conclusion
-- Solution: Contenu unique et spécifique pour chaque pièce

-- ============================================================================
-- PLAQUETTES DE FREIN (ID 402)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide
SET
  sgpg_risk_explanation = 'Des plaquettes de frein usées perdent leur capacité de friction. La garniture amincie ne peut plus appuyer efficacement sur le disque, allongeant dangereusement les distances de freinage. En cas d''urgence, chaque mètre compte.',
  sgpg_risk_consequences = '["distances de freinage multipliées par 2 ou 3", "rayures profondes sur les disques (remplacement obligatoire)", "surchauffe du système de freinage", "perte totale de freinage en cas de garniture complètement usée", "bruit métallique strident (témoin d''usure)"]'::jsonb,
  sgpg_risk_conclusion = 'Remplacer vos plaquettes dès les premiers signes d''usure évite d''endommager les disques et garantit un freinage optimal.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 402;

-- ============================================================================
-- DISQUES DE FREIN (ID 82)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide
SET
  sgpg_risk_explanation = 'Un disque de frein voilé ou trop fin provoque des vibrations dans le volant et la pédale de frein. L''épaisseur minimale (gravée sur le disque) ne doit jamais être dépassée sous peine de rupture.',
  sgpg_risk_consequences = '["vibrations au freinage ressenties dans le volant", "freinage irrégulier et saccadé", "usure prématurée et asymétrique des plaquettes", "surchauffe et risque de fissuration du disque", "dans les cas extrêmes : éclatement du disque"]'::jsonb,
  sgpg_risk_conclusion = 'Les disques se changent toujours par paire (gauche + droite) sur un même essieu pour garantir un freinage équilibré.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 82;

-- ============================================================================
-- ÉTRIERS DE FREIN (ID 78)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide
SET
  sgpg_risk_explanation = 'Un étrier grippé ou fuyant empêche les plaquettes d''appuyer correctement sur le disque. Le véhicule peut tirer d''un côté au freinage, signe d''un étrier défaillant.',
  sgpg_risk_consequences = '["véhicule qui tire à gauche ou à droite au freinage", "usure inégale des plaquettes (un côté plus usé)", "surchauffe localisée et odeur de brûlé", "fuite de liquide de frein (taches au sol)", "blocage de roue en cas de grippage total"]'::jsonb,
  sgpg_risk_conclusion = 'Un étrier défaillant doit être remplacé rapidement. Pensez à purger le circuit de frein après le remplacement.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 78;

-- ============================================================================
-- TÉMOIN D'USURE (ID 407)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide
SET
  sgpg_risk_explanation = 'Le témoin d''usure est un capteur qui alerte quand les plaquettes atteignent leur limite. S''il ne fonctionne pas, vous risquez de rouler avec des plaquettes complètement usées sans le savoir.',
  sgpg_risk_consequences = '["pas d''alerte au tableau de bord quand les plaquettes sont usées", "risque de rouler métal contre métal sans s''en rendre compte", "endommagement irréversible des disques", "voyant de frein qui reste allumé en permanence (faux positif)", "coût de réparation multiplié si non détecté à temps"]'::jsonb,
  sgpg_risk_conclusion = 'Remplacez le témoin d''usure à chaque changement de plaquettes pour garantir une alerte fiable.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 407;

-- ============================================================================
-- Vérification post-migration
-- ============================================================================
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Vérifier que les 4 gammes ont des textes différents
  SELECT COUNT(DISTINCT sgpg_risk_explanation) INTO v_count
  FROM __seo_gamme_purchase_guide
  WHERE sgpg_pg_id IN (402, 82, 78, 407);

  IF v_count = 4 THEN
    RAISE NOTICE 'Migration réussie : 4 textes uniques pour la famille Freinage';
  ELSE
    RAISE WARNING 'Attention : seulement % textes uniques sur 4', v_count;
  END IF;
END $$;
