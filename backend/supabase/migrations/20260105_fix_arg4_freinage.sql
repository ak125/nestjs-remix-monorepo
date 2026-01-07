-- Migration: Corriger Arg4 générique pour famille FREINAGE
-- Date: 2026-01-05
-- Problème: Arg4 "Kit complet recommandé" ne fait pas sens pour les pièces de freinage
-- Solution: Remplacer par "Changez par essieu" avec contenu spécifique

-- ============================================================================
-- 1. Plaquettes de frein (pg_id: 402)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg4_title = 'Changez par essieu',
  sgpg_arg4_content = 'Pour les plaquettes de frein, remplacez toujours les deux côtés du même essieu (avant ou arrière ensemble). Cela assure un freinage équilibré et évite une usure inégale de vos disques.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '402';

-- ============================================================================
-- 2. Disques de frein (pg_id: 82)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg4_title = 'Changez par paire',
  sgpg_arg4_content = 'Les disques de frein se changent toujours par paire (les deux du même essieu). Mélanger un disque neuf et un usé provoque un freinage déséquilibré et dangereux.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '82';

-- ============================================================================
-- 3. Étrier de frein (pg_id: 78)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg4_title = 'Pièce de sécurité critique',
  sgpg_arg4_content = 'L''étrier de frein est une pièce de sécurité. Un étrier grippé ou fuyant compromet votre capacité à freiner. N''attendez pas les premiers symptômes pour le remplacer.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '78';

-- ============================================================================
-- 4. Témoin d'usure (pg_id: 407)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg4_title = 'À changer avec les plaquettes',
  sgpg_arg4_content = 'Le témoin d''usure se change systématiquement avec les plaquettes de frein. C''est votre alerte sécurité : il déclenche le voyant tableau de bord quand les plaquettes sont usées.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '407';

-- ============================================================================
-- 5. Kit freins arrière (pg_id: 3859)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg4_title = 'Kit complet économique',
  sgpg_arg4_content = 'Le kit freins arrière complet regroupe toutes les pièces nécessaires. Vous économisez sur les pièces et évitez plusieurs interventions chez le garagiste.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '3859';

-- ============================================================================
-- 6. Mâchoires de frein (pg_id: 70)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg4_title = 'Changez par essieu',
  sgpg_arg4_content = 'Les mâchoires de frein se changent toujours par essieu complet (les deux côtés ensemble). Vérifiez aussi l''état des tambours et cylindres de roue lors du remplacement.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '70';

-- ============================================================================
-- 7. Cylindre de roue (pg_id: 277)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg4_title = 'Changez par paire',
  sgpg_arg4_content = 'Les cylindres de roue se changent par paire (les deux du même essieu). Une fuite même légère impose un remplacement immédiat pour votre sécurité.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '277';

-- ============================================================================
-- 8. Flexible de frein (pg_id: 83)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg4_title = 'Vérifiez l''état régulièrement',
  sgpg_arg4_content = 'Un flexible de frein craquelé ou gonflé doit être remplacé immédiatement. Après 10 ans ou 150 000 km, un remplacement préventif est recommandé même sans signe visible.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '83';

-- ============================================================================
-- 9. Câble frein à main (pg_id: 124)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg4_title = 'Sécurité stationnement',
  sgpg_arg4_content = 'Le câble de frein à main assure l''immobilisation de votre véhicule. Un câble détendu ou grippé est dangereux en pente. Vérifiez son efficacité régulièrement.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '124';

-- ============================================================================
-- 10. Tambour de frein (pg_id: 123)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg4_title = 'Changez par paire',
  sgpg_arg4_content = 'Les tambours de frein se changent par paire (les deux du même essieu). Profitez-en pour remplacer les mâchoires et cylindres de roue si nécessaire.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '123';

-- ============================================================================
-- 11. Maître-cylindre (pg_id: 258)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg4_title = 'Pièce centrale du freinage',
  sgpg_arg4_content = 'Le maître-cylindre distribue la pression à tout le circuit de frein. Une fuite ou un défaut interne peut provoquer une perte totale de freinage. Remplacez-le dès les premiers signes.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '258';

-- ============================================================================
-- 12. Servo-frein (pg_id: 74)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg4_title = 'Assistance au freinage',
  sgpg_arg4_content = 'Le servo-frein amplifie votre effort sur la pédale. Sans lui, freiner demande une force considérable. Un servo défaillant rend la conduite dangereuse.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '74';

-- ============================================================================
-- 13. Agrégat ABS (pg_id: 415)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg4_title = 'Électronique de sécurité',
  sgpg_arg4_content = 'L''agrégat ABS empêche le blocage des roues au freinage. Un voyant ABS allumé signale un défaut à corriger rapidement pour conserver cette sécurité active.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '415';

-- ============================================================================
-- 14. Vis de disque (pg_id: 54)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg4_title = 'Petite pièce essentielle',
  sgpg_arg4_content = 'Les vis de disque maintiennent le disque sur le moyeu. Des vis grippées ou abîmées doivent être remplacées. Utilisez toujours le couple de serrage préconisé.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '54';

-- ============================================================================
-- 15. Répartiteur de freinage (pg_id: 73)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg4_title = 'Équilibre avant/arrière',
  sgpg_arg4_content = 'Le répartiteur dose la pression entre l''avant et l''arrière. Un répartiteur défaillant provoque un freinage déséquilibré, avec risque de perte de contrôle.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '73';

-- ============================================================================
-- 16. Pompe à vide (pg_id: 387)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg4_title = 'Assistance diesel',
  sgpg_arg4_content = 'La pompe à vide alimente le servo-frein sur les moteurs diesel. Sans elle, la pédale devient dure et le freinage difficile. À vérifier si vous ressentez une pédale dure.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '387';

-- ============================================================================
-- Vérification après migration
-- ============================================================================
-- SELECT sgpg_pg_id, sgpg_arg4_title, sgpg_arg4_content
-- FROM __seo_gamme_purchase_guide
-- WHERE sgpg_pg_id IN ('402', '82', '78', '407', '3859', '70', '277', '83', '124', '123', '258', '74', '415', '54', '73', '387')
-- ORDER BY sgpg_pg_id;
