-- Migration: Contenu Expert Personnalisé - Famille FREINAGE (16 gammes)
-- Généré par Claude IA - Langage client, pas mécanique

-- ============================================
-- FAMILLE: FREINAGE (16 gammes)
-- Principe: Sécurité routière = priorité absolue
-- ============================================

-- 1. Plaquette de frein (pg_id=402)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'Les plaquettes de frein',
  sgpg_intro_role = 'Les plaquettes de frein sont les pièces qui appuient sur les disques pour ralentir et arrêter votre voiture. Elles s''usent à chaque freinage car elles absorbent toute l''énergie de décélération. C''est la pièce de sécurité n°1 de votre véhicule.',
  sgpg_intro_sync_parts = ARRAY['les disques de frein', 'les étriers', 'le liquide de frein'],
  sgpg_risk_title = 'Pourquoi ne jamais rouler avec des plaquettes usées ?',
  sgpg_risk_explanation = 'Des plaquettes trop usées perdent leur efficacité de freinage. Pire : le métal peut frotter directement sur le disque, créant des dégâts irréversibles.',
  sgpg_risk_consequences = ARRAY['distance de freinage allongée dangereusement', 'disques rayés ou voilés à remplacer aussi', 'bruit de grincement métallique inquiétant'],
  sgpg_risk_cost_range = '200 à 800 €',
  sgpg_risk_conclusion = 'Changer les plaquettes à temps coûte 50 à 100 € par essieu. Attendre peut tripler la facture avec les disques.',
  sgpg_timing_title = 'Quand faut-il les changer ?',
  sgpg_timing_years = '2 à 4 ans',
  sgpg_timing_km = '20 000 à 50 000 km',
  sgpg_timing_note = 'Vérifiez le témoin d''usure sur votre tableau de bord. En ville, elles s''usent plus vite qu''sur autoroute.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '402';

-- 2. Disque de frein (pg_id=82)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'Les disques de frein',
  sgpg_intro_role = 'Les disques de frein tournent avec vos roues. Quand vous freinez, les plaquettes serrent ces disques pour ralentir le véhicule. Ils transforment l''énergie du mouvement en chaleur.',
  sgpg_intro_sync_parts = ARRAY['les plaquettes de frein', 'les étriers', 'le moyeu de roue'],
  sgpg_risk_title = 'Pourquoi ne jamais négliger vos disques ?',
  sgpg_risk_explanation = 'Un disque usé ou voilé fait vibrer le volant au freinage. Un disque trop fin peut se fissurer sous l''effet de la chaleur.',
  sgpg_risk_consequences = ARRAY['vibrations dans le volant ou la pédale', 'freinage irrégulier et dangereux', 'usure prématurée des plaquettes neuves'],
  sgpg_risk_cost_range = '150 à 400 €',
  sgpg_risk_conclusion = 'Changez les disques en même temps que les plaquettes pour un freinage optimal et économiser la main-d''œuvre.',
  sgpg_timing_title = 'Quand faut-il les changer ?',
  sgpg_timing_years = '4 à 6 ans',
  sgpg_timing_km = '60 000 à 80 000 km',
  sgpg_timing_note = 'Les disques avant s''usent plus vite. Vérifiez leur épaisseur minimale inscrite dessus.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '82';

-- 3. Étrier de frein (pg_id=78)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'L''étrier de frein',
  sgpg_intro_role = 'L''étrier de frein est la pince qui pousse les plaquettes contre le disque quand vous appuyez sur la pédale. Il contient des pistons hydrauliques actionnés par le liquide de frein.',
  sgpg_intro_sync_parts = ARRAY['les plaquettes', 'le flexible de frein', 'le liquide de frein'],
  sgpg_risk_title = 'Pourquoi un étrier défaillant est dangereux ?',
  sgpg_risk_explanation = 'Un étrier grippé peut bloquer ou ne pas serrer correctement. Une fuite de liquide peut provoquer une perte totale de freinage.',
  sgpg_risk_consequences = ARRAY['freinage inégal (tire d''un côté)', 'usure asymétrique des plaquettes', 'surchauffe et odeur de brûlé'],
  sgpg_risk_cost_range = '150 à 350 €',
  sgpg_risk_conclusion = 'Un étrier se répare souvent (kit joints). Le remplacement complet n''est nécessaire qu''en cas de corrosion avancée.',
  sgpg_timing_title = 'Quand faut-il le changer ?',
  sgpg_timing_years = '8 à 12 ans',
  sgpg_timing_km = '150 000 à 200 000 km',
  sgpg_timing_note = 'Surveillez les fuites de liquide autour de l''étrier. Un nettoyage régulier prolonge sa durée de vie.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '78';

-- 4. Témoin d'usure (pg_id=407)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'Le témoin d''usure de frein',
  sgpg_intro_role = 'Le témoin d''usure est un petit capteur intégré aux plaquettes. Quand la plaquette est usée, il touche le disque et allume un voyant sur votre tableau de bord.',
  sgpg_intro_sync_parts = ARRAY['les plaquettes de frein', 'le tableau de bord', 'le faisceau électrique'],
  sgpg_risk_title = 'Pourquoi remplacer le témoin avec les plaquettes ?',
  sgpg_risk_explanation = 'Un témoin usé ne peut plus alerter. Vous risquez de rouler avec des plaquettes dangereusement usées sans le savoir.',
  sgpg_risk_consequences = ARRAY['aucune alerte en cas d''usure critique', 'voyant qui reste allumé en permanence', 'contrôle technique refusé'],
  sgpg_risk_cost_range = '10 à 30 €',
  sgpg_risk_conclusion = 'Le témoin coûte quelques euros. Changez-le systématiquement avec les plaquettes.',
  sgpg_timing_title = 'Quand faut-il le changer ?',
  sgpg_timing_years = '2 à 4 ans',
  sgpg_timing_km = '20 000 à 50 000 km',
  sgpg_timing_note = 'Remplacez-le à chaque changement de plaquettes. Certains véhicules en ont un par roue.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '407';

-- 5. Kit de freins arrière (pg_id=3859)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'Le kit de freins arrière',
  sgpg_intro_role = 'Le kit de freins arrière contient toutes les pièces nécessaires pour remettre à neuf le système de freinage arrière : plaquettes ou mâchoires, ressorts, et accessoires de montage.',
  sgpg_intro_sync_parts = ARRAY['les cylindres de roue', 'les tambours ou disques', 'le câble de frein à main'],
  sgpg_risk_title = 'Pourquoi opter pour un kit complet ?',
  sgpg_risk_explanation = 'Les freins arrière assurent 30% du freinage et 100% du frein à main. Des pièces fatiguées compromettent l''ensemble du système.',
  sgpg_risk_consequences = ARRAY['frein à main inefficace', 'déséquilibre au freinage', 'usure prématurée des freins avant'],
  sgpg_risk_cost_range = '80 à 200 €',
  sgpg_risk_conclusion = 'Le kit complet garantit un freinage équilibré et évite de payer deux fois la main-d''œuvre.',
  sgpg_timing_title = 'Quand faut-il le changer ?',
  sgpg_timing_years = '4 à 6 ans',
  sgpg_timing_km = '60 000 à 100 000 km',
  sgpg_timing_note = 'Les freins arrière s''usent moins vite mais ne doivent pas être négligés.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '3859';

-- 6. Mâchoires de frein (pg_id=70)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'Les mâchoires de frein',
  sgpg_intro_role = 'Les mâchoires de frein sont utilisées sur les freins à tambour, souvent à l''arrière. Elles s''écartent pour frotter contre l''intérieur du tambour et ralentir la roue.',
  sgpg_intro_sync_parts = ARRAY['le tambour de frein', 'le cylindre de roue', 'les ressorts de rappel'],
  sgpg_risk_title = 'Pourquoi des mâchoires usées sont dangereuses ?',
  sgpg_risk_explanation = 'Des mâchoires usées réduisent l''efficacité du frein à main. La garniture peut se décoller et bloquer le tambour.',
  sgpg_risk_consequences = ARRAY['frein à main qui ne tient plus en côte', 'bruit de frottement anormal', 'contrôle technique refusé'],
  sgpg_risk_cost_range = '60 à 150 €',
  sgpg_risk_conclusion = 'Les mâchoires durent longtemps mais doivent être vérifiées régulièrement.',
  sgpg_timing_title = 'Quand faut-il les changer ?',
  sgpg_timing_years = '5 à 8 ans',
  sgpg_timing_km = '80 000 à 120 000 km',
  sgpg_timing_note = 'Vérifiez le frein à main : s''il faut tirer fort ou s''il ne tient plus, les mâchoires sont sûrement usées.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '70';

-- 7. Cylindre de roue (pg_id=277)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'Le cylindre de roue',
  sgpg_intro_role = 'Le cylindre de roue pousse les mâchoires contre le tambour. C''est un petit vérin hydraulique qui transforme la pression du liquide de frein en force de freinage.',
  sgpg_intro_sync_parts = ARRAY['les mâchoires de frein', 'le flexible de frein', 'le liquide de frein'],
  sgpg_risk_title = 'Pourquoi un cylindre défaillant est critique ?',
  sgpg_risk_explanation = 'Un cylindre qui fuit perd du liquide de frein. Un cylindre grippé ne pousse plus correctement les mâchoires.',
  sgpg_risk_consequences = ARRAY['fuite de liquide visible sur la roue', 'freinage asymétrique dangereux', 'pédale de frein molle ou spongieuse'],
  sgpg_risk_cost_range = '40 à 100 €',
  sgpg_risk_conclusion = 'Le cylindre de roue est peu cher. Remplacez-le dès qu''il fuit ou grippe.',
  sgpg_timing_title = 'Quand faut-il le changer ?',
  sgpg_timing_years = '6 à 10 ans',
  sgpg_timing_km = '100 000 à 150 000 km',
  sgpg_timing_note = 'Inspectez-le à chaque changement de mâchoires. Une trace humide signale une fuite.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '277';

-- 8. Flexible de frein (pg_id=83)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'Le flexible de frein',
  sgpg_intro_role = 'Le flexible de frein est un tuyau souple qui transporte le liquide de frein jusqu''aux roues. Il permet aux roues de bouger (suspension, direction) tout en maintenant le circuit hermétique.',
  sgpg_intro_sync_parts = ARRAY['le maître-cylindre', 'l''étrier ou cylindre de roue', 'le liquide de frein'],
  sgpg_risk_title = 'Pourquoi un flexible abîmé est très dangereux ?',
  sgpg_risk_explanation = 'Un flexible craquelé peut éclater sous la pression. Un flexible gonflé absorbe la pression et rend le freinage mou.',
  sgpg_risk_consequences = ARRAY['perte totale de freinage en cas de rupture', 'pédale de frein molle et spongieuse', 'fuite de liquide de frein'],
  sgpg_risk_cost_range = '30 à 80 €',
  sgpg_risk_conclusion = 'Les flexibles sont peu chers mais vitaux. Remplacez-les préventivement après 10 ans.',
  sgpg_timing_title = 'Quand faut-il les changer ?',
  sgpg_timing_years = '8 à 12 ans',
  sgpg_timing_km = '150 000 à 200 000 km',
  sgpg_timing_note = 'Inspectez-les visuellement : craquelures, gonflements ou traces d''humidité signalent un remplacement urgent.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '83';

-- 9. Câble de frein à main (pg_id=124)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'Le câble de frein à main',
  sgpg_intro_role = 'Le câble de frein à main transmet la force de votre main jusqu''aux freins arrière. Quand vous tirez le levier, les câbles serrent les mâchoires ou les étriers pour immobiliser le véhicule.',
  sgpg_intro_sync_parts = ARRAY['le levier de frein à main', 'les mâchoires ou étriers arrière', 'les gaines de protection'],
  sgpg_risk_title = 'Pourquoi un câble usé est problématique ?',
  sgpg_risk_explanation = 'Un câble détendu ou grippé ne serre plus correctement les freins. La voiture peut rouler même frein à main serré.',
  sgpg_risk_consequences = ARRAY['véhicule qui recule en côte', 'contrôle technique refusé', 'risque de collision en stationnement'],
  sgpg_risk_cost_range = '40 à 120 €',
  sgpg_risk_conclusion = 'Un réglage peut suffire. Si le câble est effiloché ou grippé, remplacez-le.',
  sgpg_timing_title = 'Quand faut-il le changer ?',
  sgpg_timing_years = '8 à 12 ans',
  sgpg_timing_km = '150 000 à 200 000 km',
  sgpg_timing_note = 'Si le frein à main nécessite de plus en plus de crans pour tenir, faites vérifier le câble.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '124';

-- 10. Tambour de frein (pg_id=123)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'Le tambour de frein',
  sgpg_intro_role = 'Le tambour de frein est un cylindre métallique qui tourne avec la roue. Les mâchoires appuient contre sa paroi intérieure pour freiner. On le trouve souvent sur les roues arrière.',
  sgpg_intro_sync_parts = ARRAY['les mâchoires de frein', 'le cylindre de roue', 'le câble de frein à main'],
  sgpg_risk_title = 'Pourquoi un tambour usé pose problème ?',
  sgpg_risk_explanation = 'Un tambour trop usé s''ovale et provoque des vibrations. Sa surface peut devenir trop lisse et réduire le freinage.',
  sgpg_risk_consequences = ARRAY['vibrations à l''arrière au freinage', 'frein à main moins efficace', 'usure accélérée des mâchoires'],
  sgpg_risk_cost_range = '50 à 150 €',
  sgpg_risk_conclusion = 'Les tambours durent longtemps mais finissent par s''user. Remplacez-les par paire.',
  sgpg_timing_title = 'Quand faut-il les changer ?',
  sgpg_timing_years = '8 à 12 ans',
  sgpg_timing_km = '120 000 à 180 000 km',
  sgpg_timing_note = 'Vérifiez le diamètre intérieur : une valeur maximale est gravée sur le tambour.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '123';

-- 11. Maître-cylindre de frein (pg_id=258)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'Le maître-cylindre de frein',
  sgpg_intro_role = 'Le maître-cylindre transforme la pression de votre pied sur la pédale en pression hydraulique. Il envoie le liquide de frein vers toutes les roues pour les freiner.',
  sgpg_intro_sync_parts = ARRAY['le servo-frein', 'le réservoir de liquide', 'les flexibles de frein'],
  sgpg_risk_title = 'Pourquoi un maître-cylindre défaillant est critique ?',
  sgpg_risk_explanation = 'Un maître-cylindre qui fuit perd la pression hydraulique. Une pédale qui s''enfonce jusqu''au plancher signale un problème grave.',
  sgpg_risk_consequences = ARRAY['pédale de frein molle ou qui s''enfonce', 'perte partielle ou totale de freinage', 'niveau de liquide qui baisse sans fuite visible'],
  sgpg_risk_cost_range = '80 à 250 €',
  sgpg_risk_conclusion = 'Le maître-cylindre est vital. Une pédale anormale doit être vérifiée immédiatement.',
  sgpg_timing_title = 'Quand faut-il le changer ?',
  sgpg_timing_years = '10 à 15 ans',
  sgpg_timing_km = '200 000 à 300 000 km',
  sgpg_timing_note = 'Changez le liquide de frein tous les 2 ans pour préserver les joints du maître-cylindre.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '258';

-- 12. Servo-frein (pg_id=74)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'Le servo-frein',
  sgpg_intro_role = 'Le servo-frein amplifie la force de votre pied sur la pédale. Grâce au vide moteur, il démultiplie votre effort pour un freinage puissant sans forcer.',
  sgpg_intro_sync_parts = ARRAY['le maître-cylindre', 'la durite de dépression', 'la pédale de frein'],
  sgpg_risk_title = 'Pourquoi un servo-frein défaillant est dangereux ?',
  sgpg_risk_explanation = 'Sans assistance, il faut appuyer très fort sur la pédale pour freiner. En urgence, vous n''aurez peut-être pas la force nécessaire.',
  sgpg_risk_consequences = ARRAY['pédale de frein très dure', 'distance de freinage considérablement allongée', 'sifflement au freinage (fuite de vide)'],
  sgpg_risk_cost_range = '150 à 400 €',
  sgpg_risk_conclusion = 'Le servo-frein est robuste mais indispensable. Une pédale anormalement dure nécessite un diagnostic.',
  sgpg_timing_title = 'Quand faut-il le changer ?',
  sgpg_timing_years = '12 à 20 ans',
  sgpg_timing_km = '200 000 à 300 000 km',
  sgpg_timing_note = 'Le servo-frein dure souvent toute la vie du véhicule. Une membrane percée provoque une pédale dure.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '74';

-- 13. Agrégat de freinage (pg_id=415)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'L''agrégat de freinage',
  sgpg_intro_role = 'L''agrégat de freinage regroupe le servo-frein et le maître-cylindre en un seul bloc. C''est le cœur du système de freinage qui génère et distribue la pression hydraulique.',
  sgpg_intro_sync_parts = ARRAY['la pédale de frein', 'les flexibles', 'le réservoir de liquide de frein'],
  sgpg_risk_title = 'Pourquoi l''agrégat est une pièce critique ?',
  sgpg_risk_explanation = 'L''agrégat combine deux fonctions vitales. Une défaillance peut entraîner une perte totale de freinage.',
  sgpg_risk_consequences = ARRAY['pédale dure ET molle alternativement', 'fuite de liquide sous le capot', 'voyant de frein allumé'],
  sgpg_risk_cost_range = '300 à 800 €',
  sgpg_risk_conclusion = 'L''agrégat est coûteux mais dure longtemps. Un entretien régulier du liquide de frein le préserve.',
  sgpg_timing_title = 'Quand faut-il le changer ?',
  sgpg_timing_years = '15 à 20 ans',
  sgpg_timing_km = '250 000 à 350 000 km',
  sgpg_timing_note = 'Pièce rarement remplacée. Une réparation (kit joints) est souvent possible.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '415';

-- 14. Vis de disque (pg_id=54)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'Les vis de disque de frein',
  sgpg_intro_role = 'Les vis de disque maintiennent le disque de frein solidaire du moyeu de roue. Elles assurent un positionnement précis et empêchent le disque de bouger.',
  sgpg_intro_sync_parts = ARRAY['le disque de frein', 'le moyeu de roue', 'les boulons de roue'],
  sgpg_risk_title = 'Pourquoi ne pas réutiliser des vis abîmées ?',
  sgpg_risk_explanation = 'Des vis corrodées ou au filetage abîmé peuvent se desserrer. Elles se cassent parfois au démontage à cause de la rouille.',
  sgpg_risk_consequences = ARRAY['disque qui bouge et provoque des vibrations', 'vis qui se casse dans le moyeu', 'montage impossible du nouveau disque'],
  sgpg_risk_cost_range = '5 à 20 €',
  sgpg_risk_conclusion = 'Les vis de disque coûtent quelques euros. Remplacez-les systématiquement avec les disques.',
  sgpg_timing_title = 'Quand faut-il les changer ?',
  sgpg_timing_years = '4 à 6 ans',
  sgpg_timing_km = '60 000 à 80 000 km',
  sgpg_timing_note = 'Changez-les à chaque remplacement de disque. Utilisez un peu de graisse cuivrée pour faciliter le prochain démontage.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '54';

-- 15. Répartiteur de frein (pg_id=73)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'Le répartiteur de frein',
  sgpg_intro_role = 'Le répartiteur de frein dose la pression envoyée aux roues arrière. Il évite le blocage des roues arrière au freinage en adaptant la force selon la charge du véhicule.',
  sgpg_intro_sync_parts = ARRAY['le maître-cylindre', 'les flexibles arrière', 'la suspension arrière'],
  sgpg_risk_title = 'Pourquoi un répartiteur défaillant est dangereux ?',
  sgpg_risk_explanation = 'Un répartiteur bloqué envoie trop ou pas assez de pression à l''arrière. La voiture peut partir en tête-à-queue au freinage.',
  sgpg_risk_consequences = ARRAY['roues arrière qui bloquent trop facilement', 'véhicule instable au freinage', 'usure inégale des plaquettes avant/arrière'],
  sgpg_risk_cost_range = '80 à 200 €',
  sgpg_risk_conclusion = 'Le répartiteur est souvent négligé mais essentiel à la sécurité. Faites-le vérifier en cas de comportement anormal.',
  sgpg_timing_title = 'Quand faut-il le changer ?',
  sgpg_timing_years = '12 à 20 ans',
  sgpg_timing_km = '200 000 à 300 000 km',
  sgpg_timing_note = 'Pièce robuste qui dure longtemps. Sur les véhicules modernes, l''ABS remplace souvent cette fonction.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '73';

-- 16. Pompe à vide de freinage (pg_id=387)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'La pompe à vide de freinage',
  sgpg_intro_role = 'La pompe à vide crée la dépression nécessaire au servo-frein sur les moteurs diesel et certains moteurs essence turbo. Sans elle, pas d''assistance au freinage.',
  sgpg_intro_sync_parts = ARRAY['le servo-frein', 'les durites de dépression', 'le clapet anti-retour'],
  sgpg_risk_title = 'Pourquoi une pompe à vide défaillante est critique ?',
  sgpg_risk_explanation = 'Sans dépression, le servo-frein ne fonctionne plus. La pédale devient très dure et le freinage demande un effort considérable.',
  sgpg_risk_consequences = ARRAY['pédale de frein extrêmement dure', 'perte d''assistance après quelques freinages', 'bruit de sifflement sous le capot'],
  sgpg_risk_cost_range = '150 à 400 €',
  sgpg_risk_conclusion = 'La pompe à vide est indispensable sur les diesel. Une pédale dure après démarrage signale souvent ce problème.',
  sgpg_timing_title = 'Quand faut-il la changer ?',
  sgpg_timing_years = '10 à 15 ans',
  sgpg_timing_km = '150 000 à 250 000 km',
  sgpg_timing_note = 'Sur diesel, la pompe est souvent entraînée par le moteur. Surveillez les fuites d''huile autour.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '387';

-- Vérification
SELECT sgpg_pg_id, sgpg_intro_title, LEFT(sgpg_intro_role, 50) as intro_preview
FROM __seo_gamme_purchase_guide
WHERE sgpg_pg_id IN ('402', '82', '78', '407', '3859', '70', '277', '83', '124', '123', '258', '74', '415', '54', '73', '387')
ORDER BY sgpg_pg_id;
