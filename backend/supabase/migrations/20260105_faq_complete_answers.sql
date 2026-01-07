-- Migration: Compléter les réponses FAQ manquantes pour famille FREINAGE
-- Date: 2026-01-05
-- Objectif: Ajouter les 2 réponses FAQ vides pour pg_id 402 (Plaquettes de frein)

-- ============================================================================
-- Plaquettes de frein (pg_id: 402) - Ajouter les 2 réponses manquantes
-- ============================================================================

UPDATE __seo_gamme_purchase_guide SET
  sgpg_faq = '[
    {
      "question": "Combien coûte le remplacement des plaquettes de frein ?",
      "answer": "Le prix des plaquettes varie entre 20€ et 80€ par essieu selon la marque. La main d''œuvre chez un garagiste coûte environ 50€ à 100€. Chez Automecanik, vous économisez en achetant la pièce au meilleur prix et en la faisant monter chez votre garagiste."
    },
    {
      "question": "Peut-on changer les plaquettes soi-même ?",
      "answer": "Oui, avec des connaissances en mécanique et l''outillage adapté. Il faut lever le véhicule, démonter la roue, retirer l''étrier et remplacer les plaquettes. Attention : le freinage est critique pour votre sécurité, faites-le vérifier par un professionnel si vous avez un doute."
    },
    {
      "question": "Combien de temps durent des plaquettes de frein ?",
      "answer": "En moyenne, les plaquettes durent entre 30 000 et 60 000 km. Cela dépend du véhicule, du style de conduite (ville/autoroute) et de la qualité des plaquettes. Un contrôle à chaque révision est recommandé."
    },
    {
      "question": "Faut-il changer les plaquettes avant et arrière en même temps ?",
      "answer": "Non. L''avant s''use généralement plus vite car il supporte 70% de l''effort de freinage. En revanche, on remplace toujours les deux côtés du même essieu (gauche + droite) pour garder un freinage équilibré."
    },
    {
      "question": "Comment savoir si mes plaquettes sont usées ?",
      "answer": "Plusieurs signes : un voyant au tableau de bord, un bruit métallique au freinage, une pédale qui s''enfonce plus que d''habitude, ou un véhicule qui tire d''un côté au freinage. L''épaisseur minimale de la garniture est généralement de 2 à 3 mm."
    }
  ]',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '402';

-- ============================================================================
-- Disques de frein (pg_id: 82) - FAQ complètes
-- ============================================================================

UPDATE __seo_gamme_purchase_guide SET
  sgpg_faq = '[
    {
      "question": "Faut-il changer les disques en même temps que les plaquettes ?",
      "answer": "Pas systématiquement. Les disques durent généralement 2 à 3 fois plus longtemps que les plaquettes. Cependant, si les disques sont voilés, rayés ou en dessous de l''épaisseur minimale, il faut les remplacer. Un bon réflexe : vérifier leur état à chaque changement de plaquettes."
    },
    {
      "question": "Comment savoir si mes disques de frein sont usés ?",
      "answer": "Les signes d''usure : vibrations dans le volant ou la pédale au freinage, sillon visible sur le disque, disque bleuté (surchauffe), épaisseur inférieure au minimum indiqué sur le disque. Faites-les mesurer par un professionnel en cas de doute."
    },
    {
      "question": "Peut-on rectifier les disques de frein au lieu de les changer ?",
      "answer": "C''est possible si l''épaisseur après rectification reste supérieure au minimum. Cependant, le coût de la rectification est souvent proche du prix de disques neufs, et des disques neufs offrent de meilleures performances de freinage."
    }
  ]',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '82';

-- ============================================================================
-- Étriers de frein (pg_id: 78) - FAQ complètes
-- ============================================================================

UPDATE __seo_gamme_purchase_guide SET
  sgpg_faq = '[
    {
      "question": "Comment savoir si un étrier de frein est défaillant ?",
      "answer": "Signes révélateurs : véhicule qui tire d''un côté au freinage, roue qui chauffe anormalement, fuite de liquide de frein près de la roue, usure inégale des plaquettes, ou bruit de frottement même sans freiner."
    },
    {
      "question": "Peut-on réparer un étrier de frein ?",
      "answer": "Oui, dans certains cas on peut remplacer les joints et pistons (kit de rénovation). Cependant, si l''étrier est corrodé ou fissuré, le remplacement complet est obligatoire. Pour la sécurité, privilégiez une pièce neuve ou reconditionnée par un professionnel."
    },
    {
      "question": "Faut-il changer les deux étriers en même temps ?",
      "answer": "Pas obligatoirement. Contrairement aux plaquettes, on peut remplacer un seul étrier défaillant. Cependant, si les deux étriers ont le même âge et kilométrage, il peut être judicieux de les remplacer ensemble pour éviter une nouvelle intervention."
    }
  ]',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '78';

-- ============================================================================
-- Vérification après migration
-- ============================================================================
-- SELECT sgpg_pg_id, sgpg_faq
-- FROM __seo_gamme_purchase_guide
-- WHERE sgpg_pg_id IN ('402', '82', '78')
-- ORDER BY sgpg_pg_id;
