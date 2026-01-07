-- Migration: Simplifier le contenu "Comment choisir" pour famille FREINAGE
-- Date: 2026-01-05
-- Objectif: Supprimer les termes techniques (organique/semi-métallique/céramique)
--           et rendre le contenu plus rassurant pour le client

-- ============================================================================
-- 1. Plaquettes de frein (pg_id: 402)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_how_to_choose = 'Le choix des plaquettes de frein dépend de votre véhicule.

En sélectionnant votre voiture sur Automecanik, nous affichons uniquement les plaquettes compatibles, conformes aux préconisations constructeur.

Pour un usage quotidien, les plaquettes standard d''origine offrent le meilleur équilibre entre sécurité, confort et longévité. Nous proposons des marques de confiance : Brembo, Bosch, TRW, Ferodo.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '402';

-- ============================================================================
-- 2. Disques de frein (pg_id: 82)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_how_to_choose = 'Le choix du disque de frein dépend de votre véhicule.

En sélectionnant votre voiture sur Automecanik, nous affichons uniquement les disques compatibles avec le diamètre et l''épaisseur d''origine.

Respectez toujours les dimensions constructeur pour un freinage optimal. Les disques se changent par paire (essieu complet). Marques recommandées : Brembo, ATE, TRW, Bosch.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '82';

-- ============================================================================
-- 3. Étrier de frein (pg_id: 78)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_how_to_choose = 'Le choix de l''étrier de frein dépend de votre véhicule.

En sélectionnant votre voiture sur Automecanik, nous affichons uniquement les étriers compatibles avec votre système de freinage.

L''étrier est une pièce de sécurité critique. Privilégiez les pièces neuves ou reconditionnées par des professionnels. Marques de confiance : ATE, TRW, Brembo.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '78';

-- ============================================================================
-- 4. Témoin d'usure (pg_id: 407)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_how_to_choose = 'Le choix du témoin d''usure dépend de votre véhicule.

En sélectionnant votre voiture sur Automecanik, nous affichons uniquement les témoins compatibles avec votre système de freinage.

Le témoin d''usure se change systématiquement avec les plaquettes. C''est votre alerte sécurité sur le tableau de bord.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '407';

-- ============================================================================
-- 5. Kit freins arrière (pg_id: 3859)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_how_to_choose = 'Le choix du kit freins arrière dépend de votre véhicule.

En sélectionnant votre voiture sur Automecanik, nous affichons uniquement les kits compatibles, avec toutes les pièces nécessaires.

Le kit complet est économique : vous avez tout en une commande et évitez une seconde intervention chez le garagiste.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '3859';

-- ============================================================================
-- 6. Mâchoires de frein (pg_id: 70)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_how_to_choose = 'Le choix des mâchoires de frein dépend de votre véhicule.

En sélectionnant votre voiture sur Automecanik, nous affichons uniquement les mâchoires compatibles avec vos tambours.

Les mâchoires se changent par essieu (les deux côtés ensemble). Vérifiez aussi l''état des tambours lors du remplacement.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '70';

-- ============================================================================
-- 7. Cylindre de roue (pg_id: 277)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_how_to_choose = 'Le choix du cylindre de roue dépend de votre véhicule.

En sélectionnant votre voiture sur Automecanik, nous affichons uniquement les cylindres compatibles avec votre système de freinage.

Les cylindres de roue se changent par paire. Une fuite, même légère, impose un remplacement immédiat.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '277';

-- ============================================================================
-- 8. Flexible de frein (pg_id: 83)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_how_to_choose = 'Le choix du flexible de frein dépend de votre véhicule.

En sélectionnant votre voiture sur Automecanik, nous affichons uniquement les flexibles compatibles avec votre circuit de freinage.

Un flexible craquelé ou gonflé doit être remplacé immédiatement. Après 10 ans, un remplacement préventif est recommandé.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '83';

-- ============================================================================
-- 9. Câble frein à main (pg_id: 124)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_how_to_choose = 'Le choix du câble de frein à main dépend de votre véhicule.

En sélectionnant votre voiture sur Automecanik, nous affichons uniquement les câbles compatibles.

Un câble détendu ou grippé est dangereux en pente. Vérifiez régulièrement que le frein à main immobilise correctement votre véhicule.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '124';

-- ============================================================================
-- 10. Tambour de frein (pg_id: 123)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_how_to_choose = 'Le choix du tambour de frein dépend de votre véhicule.

En sélectionnant votre voiture sur Automecanik, nous affichons uniquement les tambours compatibles avec les dimensions d''origine.

Les tambours se changent par paire. Profitez-en pour remplacer les mâchoires et cylindres de roue si nécessaire.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '123';

-- ============================================================================
-- 11. Maître-cylindre (pg_id: 258)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_how_to_choose = 'Le choix du maître-cylindre dépend de votre véhicule.

En sélectionnant votre voiture sur Automecanik, nous affichons uniquement les maître-cylindres compatibles.

Le maître-cylindre est la pièce centrale du freinage. Une fuite ou un défaut peut provoquer une perte totale de freinage.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '258';

-- ============================================================================
-- 12. Servo-frein (pg_id: 74)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_how_to_choose = 'Le choix du servo-frein dépend de votre véhicule.

En sélectionnant votre voiture sur Automecanik, nous affichons uniquement les servo-freins compatibles.

Le servo-frein amplifie votre effort sur la pédale. Sans lui, freiner demande une force considérable.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '74';

-- ============================================================================
-- 13. Agrégat ABS (pg_id: 415)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_how_to_choose = 'Le choix de l''agrégat ABS dépend de votre véhicule.

En sélectionnant votre voiture sur Automecanik, nous affichons uniquement les agrégats compatibles.

L''ABS empêche le blocage des roues au freinage. Un voyant ABS allumé signale un défaut à corriger rapidement.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '415';

-- ============================================================================
-- 14. Vis de disque (pg_id: 54)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_how_to_choose = 'Le choix des vis de disque dépend de votre véhicule.

En sélectionnant votre voiture sur Automecanik, nous affichons uniquement les vis compatibles.

Les vis de disque maintiennent le disque sur le moyeu. Des vis grippées ou abîmées doivent être remplacées.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '54';

-- ============================================================================
-- 15. Répartiteur de freinage (pg_id: 73)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_how_to_choose = 'Le choix du répartiteur de freinage dépend de votre véhicule.

En sélectionnant votre voiture sur Automecanik, nous affichons uniquement les répartiteurs compatibles.

Le répartiteur dose la pression entre l''avant et l''arrière. Un répartiteur défaillant provoque un freinage déséquilibré.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '73';

-- ============================================================================
-- 16. Pompe à vide (pg_id: 387)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_how_to_choose = 'Le choix de la pompe à vide dépend de votre véhicule.

En sélectionnant votre voiture sur Automecanik, nous affichons uniquement les pompes compatibles.

La pompe à vide alimente le servo-frein sur les moteurs diesel. Sans elle, la pédale devient dure et le freinage difficile.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '387';

-- ============================================================================
-- Vérification après migration
-- ============================================================================
-- SELECT sgpg_pg_id, LEFT(sgpg_how_to_choose, 100) as preview
-- FROM __seo_gamme_purchase_guide
-- WHERE sgpg_pg_id IN ('402', '82', '78', '407', '3859', '70', '277', '83', '124', '123', '258', '74', '415', '54', '73', '387')
-- ORDER BY sgpg_pg_id;
